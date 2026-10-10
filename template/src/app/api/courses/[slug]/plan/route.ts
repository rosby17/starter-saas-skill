import { signature, site } from '@/config/site'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { hasProductAccess } from '@/lib/access'
import { checkRateLimit } from '@/lib/rate-limit'
import { askClaude, firstJson, kieConfigured } from '@/lib/ai/kie'
import { QUESTIONS, personalPlan, type Answers, type PersonalPlan } from '@/lib/course/onboarding'

export const runtime = 'nodejs'
export const maxDuration = 30

const aiSchema = z.object({
  intro: z.string().min(10).max(400),
  start: z.string().min(10).max(400),
  goal: z.string().min(10).max(400),
  rhythm: z.string().min(10).max(300),
  focus: z.array(z.string().max(200)).max(4),
})

/**
 * Fin du questionnaire d'accueil : enregistre les réponses et prépare le parcours personnalisé.
 * Claude (kie.ai) lit les réponses et le sommaire du cours, puis écrit le plan dans la voix du formateur ;
 * sans clé ou en cas d'échec, plan par règles. Le plan est enregistré (course_onboarding.plan).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ success: false }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const { data: product } = await supabase.from('products').select('id, title').eq('slug', slug).maybeSingle()
  if (!product || !(await hasProductAccess(supabase, user.id, product.id))) return NextResponse.json({ success: false }, { status: 403 })

  const { data: row } = await supabase.from('course_onboarding').select('answers').eq('user_id', user.id).eq('product_id', product.id).maybeSingle()
  const answers = (row?.answers ?? {}) as Answers
  const { data: profile } = await supabase.from('profiles').select('first_name, full_name').eq('id', user.id).maybeSingle()
  const name = (typeof answers.firstName === 'string' && answers.firstName) || profile?.first_name || profile?.full_name?.split(' ')[0] || ''

  const rules = personalPlan(answers)
  let plan: PersonalPlan = rules
  let source: 'ia' | 'regles' = 'regles'

  if (kieConfigured() && checkRateLimit(`plan:${user.id}`, 5, 60 * 60_000).success) {
    try {
      const { data: outline } = await supabase.rpc('course_outline', { p_product_id: product.id })
      const sommaire = ((outline ?? []) as { section: string | null; title: string }[]).map((l) => `- ${l.section ?? ''} › ${l.title}`).join('\n')
      const reponses = QUESTIONS.filter((q) => q.kind !== 'text').map((q) => {
        const v = answers[q.id]
        const vals = (Array.isArray(v) ? v : v ? [v] : []).map((x) => (q.options.find((o) => o.value === x)?.label ?? x))
        return `- ${q.title} ${vals.join(', ') || '(pas de réponse)'}`
      }).join('\n')
      const text = await askClaude(
        `Formation : « ${product.title} ».\nPrénom de l'élève : ${name || '(inconnu)'}.\n\nSes réponses au questionnaire d'accueil :\n${reponses}\n\nSommaire du cours :\n${sommaire}\n\n` +
        `Rédige son plan personnalisé. Réponds UNIQUEMENT avec un objet JSON :\n` +
        `{"intro": "2 phrases chaleureuses qui montrent que tu as compris son besoin", "start": "par où commencer et comment travailler (2 phrases)", ` +
        `"goal": "ce qui, dans le cours, sert le plus son objectif (2 phrases, cite les modules)", "rhythm": "un rythme réaliste selon son temps (1 phrase)", ` +
        `"focus": ["3 titres EXACTS de leçons du sommaire à ne pas manquer"]}`,
        {
          system: `Tu es ${signature()}, formateur de la plateforme « ${site.name} », et tu écris à ton élève : français simple, tutoiement, ton chaleureux et concret, phrases courtes, pas de jargon, pas d'emoji, pas de flatterie. Tu ne promets aucun revenu ni résultat chiffré.`,
          maxTokens: 900,
        },
      )
      const parsed = aiSchema.safeParse(firstJson(text))
      if (parsed.success) {
        plan = { ...rules, ...parsed.data }
        source = 'ia'
      }
    } catch (error) {
      console.error('Plan IA indisponible, plan par règles :', (error as Error).message)
    }
  }

  // Écrit par le serveur : l'élève ne peut pas fabriquer son propre « plan ».
  const { error } = await serviceClient().from('course_onboarding').upsert(
    { user_id: user.id, product_id: product.id, answers, plan, plan_source: source, completed_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id' },
  )
  if (error) {
    console.error('Plan non enregistré :', error.message)
    return NextResponse.json({ success: false, message: 'Ton parcours n’a pas pu être enregistré. Réessaie.' }, { status: 500 })
  }
  return NextResponse.json({ success: true, plan, source })
}
