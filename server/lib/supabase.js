import { createClient } from "@supabase/supabase-js";
import { getEnv, requireAnyEnv } from "./env.js";

export function getSupabaseUrl() {
  return requireAnyEnv(["SUPABASE_URL"]);
}

export function createSupabaseAnonClient() {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getEnv("VITE_SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("Missing VITE_SUPABASE_ANON_KEY in environment.");
  return createClient(supabaseUrl, anonKey);
}

export function createSupabaseUserClient(accessToken) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getEnv("VITE_SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("Missing VITE_SUPABASE_ANON_KEY in environment.");
  if (!accessToken) return createClient(supabaseUrl, anonKey);

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function createSupabaseServiceClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return null;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function getAuthedUser(accessToken) {
  if (!accessToken) return null;
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return null;
  return data?.user || null;
}
