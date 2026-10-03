import { applyStoredSecrets } from '@/lib/secrets/store'

export async function startSecretsSync() {
  try {
    await applyStoredSecrets()
  } catch (error) {
    console.error('Chargement des clés de l’admin impossible :', error)
  }
  setInterval(() => { applyStoredSecrets().catch((error) => console.error('Relecture des clés impossible :', error)) }, 60_000).unref()
}
