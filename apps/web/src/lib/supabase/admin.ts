import { createClient } from "@supabase/supabase-js";

const resolveServiceRoleKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_TARGET_SERVICE_ROLE_KEY;
const resolveSupabaseUrl = () => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

export const createSupabaseAdminClient = () => {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};
