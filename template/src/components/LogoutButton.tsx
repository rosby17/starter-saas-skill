// Plain HTML form: works without JavaScript and always clears the session cookies server-side.
export function LogoutButton({ label = 'Se déconnecter', className }: { label?: string; className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className ?? 'text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline'}>
        {label}
      </button>
    </form>
  )
}
