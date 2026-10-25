import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requiredEnv } from "./http.ts";

export async function requireUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { user: null, error: "Authentication required." };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: "Your session is invalid or expired." };
  }
  if (data.user.app_metadata?.messaging_access !== true) {
    return { user: null, error: "This account is not authorized to access the messaging inbox." };
  }
  return { user: data.user, error: null };
}

export function serviceClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
