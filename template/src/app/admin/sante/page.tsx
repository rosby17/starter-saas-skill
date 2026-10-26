import { redirect } from 'next/navigation'

// L'ancienne page « Santé » est fusionnée dans « Erreurs » (problèmes, occurrences et santé des services au même endroit).
export default function AdminSantePage() {
  redirect('/admin/erreurs')
}
