// Helpers compartilhados para chamadas à API Asaas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const ASAAS_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

export type AsaasEnv = "sandbox" | "production";

export function getAsaasKey(env: AsaasEnv): string {
  const key = env === "production"
    ? Deno.env.get("ASAAS_API_KEY_PRODUCTION")
    : Deno.env.get("ASAAS_API_KEY_SANDBOX");
  if (!key) throw new Error(`ASAAS_API_KEY_${env.toUpperCase()} não configurada`);
  return key;
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function asaasFetch(env: AsaasEnv, path: string, init: RequestInit = {}) {
  const base = ASAAS_URLS[env];
  const key = getAsaasKey(env);
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "access_token": key,
      "User-Agent": "VeloHub-Financial/1.0",
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!resp.ok) {
    const msg = json?.errors?.[0]?.description || json?.message || text || `HTTP ${resp.status}`;
    throw new Error(`Asaas: ${msg}`);
  }
  return json;
}

export async function getSettings(): Promise<{ env: AsaasEnv; settings: any }> {
  const sb = getServiceClient();
  const { data, error } = await sb.from("asaas_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Configurações Asaas não encontradas");
  return { env: data.environment as AsaasEnv, settings: data };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}