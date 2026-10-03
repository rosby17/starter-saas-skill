import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Patch getUser to fallback to Bearer token for maximum robustness against cookie expiration issues
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  (supabase.auth as any).getUser = async (jwt?: string) => {
    if (jwt) return originalGetUser(jwt);

    const { data, error } = await originalGetUser();
    if (data?.user) return { data, error };

    try {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return originalGetUser(token);
      }
    } catch (e) {
      // Ignore: headers() can throw if called outside a request context
    }

    return { data, error };
  };

  return supabase;
}
