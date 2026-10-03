export function createContentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDevelopment,
}: {
  nonce: string;
  supabaseUrl: string;
  isDevelopment: boolean;
}): string {
  const supabase = new URL(supabaseUrl);
  if (supabase.protocol !== "https:" && supabase.protocol !== "http:") {
    throw new Error("Supabase must use an HTTP or HTTPS URL.");
  }
  const realtime = new URL(supabase.origin);
  realtime.protocol = supabase.protocol === "https:" ? "wss:" : "ws:";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${supabase.origin} ${realtime.origin}`,
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}
