import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// Mon compte : identité du membre (nom, @pseudo, présentation, WhatsApp, pays). RLS : chacun ne modifie que SON profil.
const schema = z.object({
  full_name: z.string().trim().max(120).default(''),
  username: z.string().trim().toLowerCase().max(30).default('').refine((v) => !v || /^[a-z0-9_.]{3,30}$/.test(v), 'Pseudo : 3 à 30 caractères, lettres minuscules, chiffres, point ou tiret bas.'),
  bio: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(30).default(''),
  country: z.string().trim().max(60).default(''),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  if (!checkRateLimit(`profile:${user.id}`, 30, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Trop de modifications : réessaie plus tard.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Formulaire invalide.' }, { status: 400 })
  const d = parsed.data
  const phone = d.phone.replace(/[^\d+]/g, '').slice(0, 20)
  const { error } = await supabase.from('profiles').update({
    full_name: d.full_name || null, first_name: d.full_name.split(/\s+/)[0] || null, username: d.username || null,
    bio: d.bio || null, phone: phone || null, country: d.country || null,
  }).eq('id', user.id)
  if (error) return NextResponse.json({ success: false, message: error.code === '23505' ? 'Ce pseudo est déjà pris : choisis-en un autre.' : 'Enregistrement impossible.' }, { status: 400 })
  return NextResponse.json({ success: true, message: 'Profil enregistré.' })
}
