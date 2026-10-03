import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Retrieves the raw access token directly from localStorage.
 * This bypasses supabase-js local clock checks, which prevents "session expired" errors
 * when the user's computer clock is improperly set (clock skew).
 */
export function getRawAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0];
    if (!projectId) return null;
    const storageKey = `sb-${projectId}-auth-token`;
    const tokenData = localStorage.getItem(storageKey);
    if (tokenData) {
      const parsed = JSON.parse(tokenData);
      return parsed?.access_token || null;
    }
  } catch (err) {
    console.error("Error reading raw token:", err);
  }
  return null;
}
