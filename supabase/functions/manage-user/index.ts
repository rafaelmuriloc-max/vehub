import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.98.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = claimsData.claims.sub as string;

    // Check admin role
    const { data: roleCheck } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    if (action === "create" || action === "invite") {
      const { email, password, full_name, job_title, department_id, role, tag_color } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (typeof password !== "string" || password.length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userId = created.user.id;

      // Update profile (created by trigger handle_new_user)
      if (job_title || department_id || tag_color !== undefined) {
        await adminClient.from("profiles").update({
          job_title: job_title || null,
          department_id: department_id || null,
          ...(tag_color !== undefined ? { tag_color: tag_color || null } : {}),
        }).eq("user_id", userId);
      }

      // Update role if admin
      if (role === "admin") {
        await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { user_id, full_name, job_title, department_id, role, tag_color } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const profileUpdate: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name || null;
      if (job_title !== undefined) profileUpdate.job_title = job_title || null;
      if (department_id !== undefined) profileUpdate.department_id = department_id || null;
      if (tag_color !== undefined) profileUpdate.tag_color = tag_color || null;
      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }
      if (role === "admin" || role === "employee") {
        await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
