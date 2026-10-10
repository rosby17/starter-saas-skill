import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { TWO_FACTOR_COOKIE, secondFactorPending } from '@/lib/auth/two-factor-gate'

// Pages réservées aux comptes connectés (tout le reste est public : boutique, pages de vente, paiement…).
const privatePrefixes = ['/mes-achats', '/credits', '/communaute', '/appels', '/cours', '/demandes', '/dashboard', '/settings', '/support', '/billing-history', '/billing', '/admin']

// Validation en deux étapes : ces adresses restent accessibles pendant qu'on saisit le code.
const TWO_FACTOR_PAGE = '/login/verification'
const twoFactorExempt = [TWO_FACTOR_PAGE, '/api/account/2fa', '/auth', '/api/payment/webhook', '/api/cron', '/api/health']

function isPublicPath(pathname: string) {
  return !privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function redirectWithCookies(url: URL, supabaseResponse: NextResponse, status = 307) {
  const redirectRes = NextResponse.redirect(url, status)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectRes.cookies.set(cookie.name, cookie.value, cookie)
  })
  return redirectRes
}

// Supabase pas encore branché (valeurs d'exemple de .env.example) : en local, tout mène à l'assistant /setup.
const supabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!url && /^https?:\/\//.test(url) && !url.includes('your-project')
}

// En local, tant qu'aucun administrateur n'existe, l'installation n'est pas finie : on y ramène.
// Une fois l'administrateur trouvé, on le retient pour ne plus interroger la base.
let adminExists = false
async function localAdminExists(): Promise<boolean> {
  if (adminExists) return true
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id&is_admin=eq.true&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    adminExists = res.ok && ((await res.json()) as unknown[]).length > 0
  } catch {
    // Base injoignable : on laisse passer, la page affichera son erreur.
    return true
  }
  return adminExists
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isSetup = pathname === '/setup' || pathname.startsWith('/api/setup')

  if (!supabaseConfigured()) {
    if (isSetup) return NextResponse.next()
    if (process.env.NODE_ENV !== 'production') {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
    return new NextResponse('Configuration incomplète : NEXT_PUBLIC_SUPABASE_URL manquant sur le serveur.', { status: 503 })
  }

  if (process.env.NODE_ENV !== 'production' && !isSetup && !pathname.startsWith('/api/') && !pathname.startsWith('/auth/') && !(await localAdminExists())) {
    const url = request.nextUrl.clone()
    url.pathname = '/setup'
    url.search = ''
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // --- Maintenance-mode gate -------------------------------------------
  // Reads a single row from `system_settings` (key = 'maintenance') so the
  // whole app can be paused from the admin dashboard without a redeploy.
  // Table + public SELECT policy on this key: supabase/migrations/0001_init.sql.
  const maintenanceExemptPaths = ['/maintenance', '/admin', '/api/admin', '/login', '/signup', '/reset-password', '/auth', '/api/payment/webhook', '/api/cron', '/api/health', '/sw.js', '/manifest.webmanifest', '/offline.html']
  const isMaintenanceExempt = maintenanceExemptPaths.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (pathname === '/maintenance' || !isMaintenanceExempt) {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance')
        .maybeSingle()
      const value = data?.value as { enabled?: unknown } | undefined
      const maintenanceEnabled = value?.enabled === true

      if (pathname === '/maintenance' && !maintenanceEnabled) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.search = ''
        return redirectWithCookies(url, supabaseResponse, 307)
      }

      if (maintenanceEnabled && !isMaintenanceExempt) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { success: false, message: 'Le site est en maintenance. Réessaie dans quelques minutes.' },
            { status: 503, headers: { 'Retry-After': '300' } }
          )
        }
        const url = request.nextUrl.clone()
        url.pathname = '/maintenance'
        url.search = ''
        return redirectWithCookies(url, supabaseResponse, 307)
      }
    } catch {
      // Don't take the whole app down if the settings table is unreachable.
    }
  }

  // --- Auth gate ----------------------------------------------------------
  const isApiRoute = pathname.startsWith('/api')
  const isPublic = isPublicPath(pathname)

  // Les routes /api sont « publiques » pour le middleware (chacune vérifie la session) ; on lit quand même
  // l'utilisateur quand il y a une session, pour bloquer celles d'une connexion sans deuxième étape.
  const exemptFrom2fa = twoFactorExempt.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  const apiWithSession = isApiRoute && hasSessionCookie && !exemptFrom2fa

  let user = null
  if (!isPublic || pathname === '/login' || apiWithSession) {
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  // --- Deuxième étape (code par e-mail ou application d'authentification) -----
  if (user && !exemptFrom2fa && (!isPublic || pathname === '/login' || apiWithSession)) {
    const { data: { session } } = await supabase.auth.getSession()
    const pending = await secondFactorPending(user, session?.access_token, request.cookies.get(TWO_FACTOR_COOKIE)?.value)
    if (pending) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, message: 'Validation en deux étapes requise : saisis ton code.' }, { status: 401 })
      }
      const url = request.nextUrl.clone()
      const wanted = pathname === '/login' ? url.searchParams.get('next') || '/dashboard' : pathname + request.nextUrl.search
      url.pathname = TWO_FACTOR_PAGE
      url.search = ''
      url.searchParams.set('next', wanted)
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  if (!user && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone()
    const returnTo = pathname + request.nextUrl.search
    url.pathname = '/login'
    url.searchParams.set('next', returnTo)
    return redirectWithCookies(url, supabaseResponse)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    const rawNext = url.searchParams.get('next')
    url.searchParams.delete('next')
    if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')) {
      try {
        const targetUrl = new URL(rawNext, request.url)
        url.pathname = targetUrl.pathname
        url.search = targetUrl.search
      } catch {
        url.pathname = '/dashboard'
      }
    } else {
      url.pathname = '/dashboard'
    }
    return redirectWithCookies(url, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.mp4|.*\\.otf).*)',
  ],
}
