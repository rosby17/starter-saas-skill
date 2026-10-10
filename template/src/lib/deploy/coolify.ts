import { callJson, DeployError, sleep } from './http'

// API Coolify v4 (Jeton : Coolify > Keys & Tokens > API tokens, droit « root », ou « read » + « read:sensitive » + « write » + « deploy » :
// read:sensitive sert à lire les clés de la base Supabase installée sur le serveur).
export type CoolifyServer = { uuid: string; name: string; ip: string }

const api = (baseUrl: string) => `${baseUrl.replace(/\/+$/, '')}/api/v1`

// Attention : Coolify injecte LUI-MÊME une variable COOLIFY_URL dans chaque application, égale à l'adresse du site
// (« https://site,https://www.site »). Si c'est elle qu'on lit (pas l'adresse saisie dans Clés et intégrations), on
// l'ignore : l'adresse du tableau de bord se déduit alors du domaine (coolify.<domaine>), à défaut celle par défaut.
export function coolifyBaseUrl(raw = process.env.COOLIFY_URL || ''): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  const looksInjected = raw.includes(',') || (!!site && raw.replace(/\/+$/, '') === site)
  if (raw && !looksInjected) return raw
  const host = (raw.split(',')[0] || site).replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const domain = host.split('.').slice(-2).join('.')
  return domain.includes('.') ? `https://coolify.${domain}` : ''
}

export function coolify(baseUrl: string, token: string) {
  const base = api(coolifyBaseUrl(baseUrl))
  const call = <T>(path: string, init?: Parameters<typeof callJson>[3]) => callJson<T>('Coolify', `${base}${path}`, token, init)

  return {
    listServers: () => call<CoolifyServer[]>('/servers'),

    createProject: async (name: string) => (await call<{ uuid: string }>('/projects', { method: 'POST', body: { name, description: 'Créé par la mise en ligne du SaaS' } })).uuid,

    addPrivateKey: async (name: string, privateKey: string) =>
      (await call<{ uuid: string }>('/security/keys', { method: 'POST', body: { name, private_key: privateKey } })).uuid,

    createApp: async (input: { projectUuid: string; serverUuid: string; privateKeyUuid: string; gitRepository: string; name: string; domain: string }) =>
      (await call<{ uuid: string }>('/applications/private-deploy-key', {
        method: 'POST',
        body: {
          project_uuid: input.projectUuid,
          server_uuid: input.serverUuid,
          environment_name: 'production',
          private_key_uuid: input.privateKeyUuid,
          git_repository: input.gitRepository,
          git_branch: 'main',
          build_pack: 'dockerfile',
          ports_exposes: '3000',
          name: input.name,
          domains: `https://${input.domain},https://www.${input.domain}`,
          is_force_https_enabled: true,
          health_check_enabled: true,
          health_check_path: '/api/health',
          instant_deploy: false,
        },
      })).uuid,

    appExists: async (uuid: string) => {
      try { await call(`/applications/${uuid}`); return true } catch { return false }
    },

    setEnvs: (appUuid: string, envs: Record<string, string>) =>
      call(`/applications/${appUuid}/envs/bulk`, {
        method: 'PATCH',
        body: { data: Object.entries(envs).map(([key, value]) => ({ key, value, is_preview: false, is_literal: true })) },
      }),

    ensureScheduledTasks: async (appUuid: string, tasks: Array<{ name: string; command: string; frequency: string }>) => {
      const existing = await call<Array<{ name: string }>>(`/applications/${appUuid}/scheduled-tasks`).catch(() => [])
      for (const task of tasks) {
        if (existing.some((t) => t.name === task.name)) continue
        await call(`/applications/${appUuid}/scheduled-tasks`, { method: 'POST', body: { ...task, enabled: true } })
      }
    },

    // --- Base de données : service « Supabase » en un clic de Coolify (open source, sur le serveur du créateur).
    createSupabase: async (input: { projectUuid: string; serverUuid: string; apiUrl: string; name: string }) =>
      (await call<{ uuid: string }>('/services', {
        method: 'POST',
        body: {
          type: 'supabase',
          name: input.name,
          description: 'Base de données du SaaS (créée par la mise en ligne)',
          project_uuid: input.projectUuid,
          server_uuid: input.serverUuid,
          environment_name: 'production',
          urls: [{ name: 'supabase-kong', url: input.apiUrl }],
          instant_deploy: false,
        },
      })).uuid,

    serviceExists: async (uuid: string) => {
      try { await call(`/services/${uuid}`); return true } catch { return false }
    },

    serviceEnvs: async (uuid: string) => {
      const list = await call<Array<{ key: string; value?: string; real_value?: string; is_preview?: boolean }>>(`/services/${uuid}/envs`)
      return Object.fromEntries(list.filter((e) => !e.is_preview).map((e) => [e.key, e.real_value ?? e.value ?? '']))
    },

    setServiceEnvs: (uuid: string, envs: Record<string, string>) =>
      call(`/services/${uuid}/envs/bulk`, {
        method: 'PATCH',
        body: { data: Object.entries(envs).map(([key, value]) => ({ key, value, is_preview: false, is_literal: true })) },
      }),

    // Le modèle Supabase de Coolify tire « minio/mc », image retirée des registres publics (« pull access denied » ou 401) :
    // tout le démarrage échoue. L'image minio du même service contient déjà `mc` : on s'en sert pour la tâche « créer le bucket ».
    fixSupabaseImages: async (uuid: string) => {
      const svc = await call<{ docker_compose_raw?: string }>(`/services/${uuid}`)
      const raw = svc.docker_compose_raw || ''
      const minio = raw.match(/supabase-minio:\s*\n\s*image:\s*['"]?([^\s'"]+)/)?.[1]
      if (!minio) return
      const fixed = raw.replace(/(minio-createbucket:\s*\n\s*image:\s*)\S+/, `$1${minio}`)
      if (fixed === raw) return
      await call(`/services/${uuid}`, { method: 'PATCH', body: { docker_compose_raw: Buffer.from(fixed).toString('base64') } })
    },

    // Connexion Google : le modèle Supabase de Coolify ne transmet pas les réglages Google au service de connexion
    // (GoTrue). On ajoute ces lignes une fois, à côté de GOTRUE_EXTERNAL_EMAIL_ENABLED ; les valeurs viennent des variables du service.
    enableGoogleAuth: async (uuid: string) => {
      const svc = await call<{ docker_compose_raw?: string }>(`/services/${uuid}`)
      const raw = svc.docker_compose_raw || ''
      if (raw.includes('GOTRUE_EXTERNAL_GOOGLE_ENABLED')) return false
      const m = raw.match(/^(\s*)- ['"]?GOTRUE_EXTERNAL_EMAIL_ENABLED=.*$/m)
      if (!m) throw new DeployError('Service de connexion introuvable dans la base Coolify : connexion Google non activée.')
      const lines = ['GOTRUE_EXTERNAL_GOOGLE_ENABLED=${GOTRUE_EXTERNAL_GOOGLE_ENABLED:-false}', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}',
        'GOTRUE_EXTERNAL_GOOGLE_SECRET=${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}', 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=${GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI:-}']
      const fixed = raw.replace(m[0], [m[0], ...lines.map((l) => `${m[1]}- ${l}`)].join('\n'))
      await call(`/services/${uuid}`, { method: 'PATCH', body: { docker_compose_raw: Buffer.from(fixed).toString('base64') } })
      return true
    },

    listServices: () => call<Array<{ uuid: string; name?: string; docker_compose_raw?: string }>>('/services'),

    startService: (uuid: string) => call(`/services/${uuid}/start`, { method: 'POST' }),
    restartService: (uuid: string) => call(`/services/${uuid}/restart`, { method: 'POST' }),

    deploy: async (appUuid: string) => {
      const res = await call<{ deployments?: Array<{ deployment_uuid: string }> }>(`/deploy?uuid=${appUuid}&force=false`, { method: 'POST' })
      const id = res.deployments?.[0]?.deployment_uuid
      if (!id) throw new DeployError('Coolify n’a pas lancé le déploiement.')
      return id
    },

    /** Attend la fin du build (5 à 10 minutes la première fois). */
    waitDeployment: async (deploymentUuid: string, onTick?: (status: string) => void, timeoutMs = 20 * 60_000) => {
      const end = Date.now() + timeoutMs
      while (Date.now() < end) {
        const d = await call<{ status: string }>(`/deployments/${deploymentUuid}`)
        onTick?.(d.status)
        if (d.status === 'finished') return
        if (['failed', 'cancelled-by-user', 'cancelled'].includes(d.status)) {
          throw new DeployError(`Le déploiement Coolify a échoué (${d.status}) : ouvre les journaux de l'application dans Coolify.`)
        }
        await sleep(8000)
      }
      throw new DeployError('Le déploiement dure plus de 20 minutes : vérifie-le dans Coolify.')
    },
  }
}
