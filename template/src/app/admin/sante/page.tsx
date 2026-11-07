import { requireAdminPage } from '@/lib/auth/admin-page'
import { redirect } from 'next/navigation'

// L'ancienne page « Santé » est fusionnée dans « Erreurs » (problèmes, occurrences et santé des services au même endroit).
export default async function AdminSantePage() {
  await requireAdminPage()
  redirect('/admin/erreurs')
}
