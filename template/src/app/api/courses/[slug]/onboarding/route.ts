import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProductAccess } from '@/lib/access'
import { onboardingBodySchema } from '@/lib/course/onboarding'

/** Enregistre les réponses du questionnaire d'accueil (au fil des écrans, puis « terminé »). Session du client + RLS. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ success: false }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = onboardingBodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Réponses invalides.' }, { status: 400 })

  const { data: product } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
  if (!product || !(await hasProductAccess(supabase, user.id, product.id))) return NextResponse.json({ success: false }, { status: 403 })

  const { answers, completed } = parsed.data
  const { error } = await supabase.from('course_onboarding').upsert(
    { user_id: user.id, product_id: product.id, answers, ...(completed ? { completed_at: new Date().toISOString() } : {}) },
    { onConflict: 'user_id,product_id' },
  )
  if (error) {
    console.error('Accueil du cours non enregistré :', error.message)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible. Réessaie.' }, { status: 500 })
  }
  // Le prénom donné devient celui du compte s'il n'en a pas encore.
  if (completed && typeof answers.firstName === 'string' && answers.firstName) {
    await supabase.from('profiles').update({ first_name: answers.firstName }).eq('id', user.id).is('first_name', null)
  }
  return NextResponse.json({ success: true })
}
