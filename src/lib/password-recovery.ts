// Capture routing intent before Supabase initialization removes the URL fragment.
export function isPasswordRecoveryUrl(href: string): boolean {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.get('reset-password') === '1'
    || fragment.get('type') === 'recovery'
    || fragment.has('error_code');
}
