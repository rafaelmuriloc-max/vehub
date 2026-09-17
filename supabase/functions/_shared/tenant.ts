/**
 * Resolução de organização em edge functions. NÃO IMPLANTADO.
 *
 * Duas superfícies distintas:
 *  - chamadas do usuário: organização vem do JWT validado (nunca do body);
 *  - webhooks: organização vem do identificador da integração + validação
 *    própria de assinatura. Ambiguidade => 400, nunca "chuta" um escritório.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export interface CallerContext {
  userId: string;
  orgId: string;
  role: "admin" | "employee";
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Valida o JWT no handler (verify_jwt=false não dispensa validação) e resolve
 * a organização ativa a partir da associação real, não de um header do cliente.
 */
export async function requireCaller(req: Request, requestedOrgId?: string): Promise<CallerContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anon.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Response("Unauthorized", { status: 401 });

  const userId = data.claims.sub as string;
  const { data: members } = await admin()
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!members?.length) throw new Response("Forbidden: sem organização", { status: 403 });

  const chosen = requestedOrgId
    ? members.find((m) => m.org_id === requestedOrgId)
    : members.length === 1
      ? members[0]
      : undefined;

  if (!chosen) throw new Response("Forbidden: organização inválida", { status: 403 });
  return { userId, orgId: chosen.org_id, role: chosen.role as CallerContext["role"] };
}

/** Admin é sempre relativo à organização do recurso. */
export function requireOrgAdmin(ctx: CallerContext) {
  if (ctx.role !== "admin") throw new Response("Forbidden: admin da organização", { status: 403 });
}

/**
 * Webhook: resolve a organização pelo identificador da integração.
 * Retorna null quando não há correspondência única — o handler deve responder
 * 400 e NÃO processar o evento.
 */
export async function resolveOrgForWebhook(
  provider: string,
  externalRef: string | null,
): Promise<string | null> {
  if (!externalRef) return null;
  const { data, error } = await admin()
    .from("organization_integrations")
    .select("org_id")
    .eq("provider", provider)
    .eq("external_ref", externalRef)
    .eq("enabled", true);
  if (error || !data || data.length !== 1) return null;
  return data[0].org_id as string;
}

/**
 * Credenciais da organização. NUNCA herda segredos de outro escritório:
 * se a integração não estiver configurada para esta organização, falha.
 */
export async function orgSecret(orgId: string, provider: string, key: string): Promise<string> {
  const { data } = await admin()
    .from("organization_integrations")
    .select("secret_names, enabled")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data?.enabled) throw new Response(`Integração ${provider} não configurada`, { status: 412 });
  const secretName = (data.secret_names as Record<string, string>)?.[key];
  if (!secretName) throw new Response(`Credencial ${key} ausente para a organização`, { status: 412 });
  const value = Deno.env.get(secretName);
  if (!value) throw new Response(`Secret ${secretName} não provisionado`, { status: 412 });
  return value;
}
