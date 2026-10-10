import { redirect } from 'next/navigation'

// Mot de passe oublié : on se connecte avec un lien reçu par e-mail, puis on choisit un nouveau mot de passe
// dans « Mon compte ». (Aucun réglage SMTP de Supabase nécessaire.)
export default function ResetPasswordPage() {
  redirect('/login?next=/settings')
}
