import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: file } = await db.from('product_files').select('storage_path').eq('id', id).maybeSingle()
  const { error } = await db.from('product_files').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 400 })
  if (file?.storage_path) await db.storage.from('files').remove([file.storage_path])
  await logAdminAction(db, auth.userId, 'file.delete', { type: 'product_file', id })
  return NextResponse.json({ success: true })
}
