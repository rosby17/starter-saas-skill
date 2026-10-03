import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that never require an authenticated session. Add any marketing,
// legal, or public API prefixes your app needs here.
const publicPrefixes = ['/login', '/signup', '/reset-password', '/setup', '/', '/api']

function isPublicPath(pathname: string) {
  return publicPrefixes.some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`))
  )
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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (!supabaseConfigured()) {
    if (pathname === '/setup' || pathname.startsWith('/api/setup')) return NextResponse.next()
    if (process.env.NODE_ENV !== 'production') {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
    return new NextResponse('Configuration incomplète : NEXT_PUBLIC_SUPABASE_URL manquant sur le serveur.', { status: 503 })
  }

  // Contrôle de santé (Docker, Coolify) : jamais bloqué par la maintenance ni par la session, sinon le conteneur
  // serait jugé malade pendant une maintenance et redémarré.
  if (pathname === '/api/health') return NextResponse.next()

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
  // TODO: create the `system_settings` table + RLS policy that allows public
  // SELECT on this one key before relying on this gate.
  const maintenanceExemptPaths = ['/maintenance', '/admin', '/api/admin', '/login', '/signup', '/reset-password']
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
            { success: false, message: 'The service is temporarily down for maintenance.' },
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

  let user = null
  if (!isPublic || pathname === '/login') {
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()
    user = supabaseUser
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
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp).*)',
  ],
}
