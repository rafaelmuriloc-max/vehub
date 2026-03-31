import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("Authenticated user:", user.email);

    // Parse and validate input
    const body = await req.json();
    const { departmentId, to, subject, html, attachments, senderName } = body;

    if (!departmentId || !to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: departmentId, to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch department SMTP credentials using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dept, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("smtp_email, smtp_password, name")
      .eq("id", departmentId)
      .single();

    if (deptError || !dept) {
      return new Response(
        JSON.stringify({ error: "Department not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dept.smtp_email || !dept.smtp_password) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured for this department" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download attachments from Supabase Storage if provided
    const emailAttachments: Array<{ filename: string; content: Uint8Array; encoding: string }> = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const { data: signedData, error: signErr } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(att.fileUrl, 120);
          if (signErr || !signedData?.signedUrl) {
            console.error("Failed to sign URL for", att.fileUrl, signErr?.message);
            continue;
          }
          const fileResp = await fetch(signedData.signedUrl);
          if (!fileResp.ok) {
            console.error("Failed to download", att.fileUrl, fileResp.status);
            continue;
          }
          const arrayBuffer = await fileResp.arrayBuffer();
          emailAttachments.push({
            filename: att.fileName || att.fileUrl.split("/").pop() || "attachment",
            content: new Uint8Array(arrayBuffer),
            encoding: "binary",
          });
        } catch (attErr) {
          console.error("Attachment error:", attErr);
        }
      }
    }

    // Send email via Gmail SMTP
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: dept.smtp_email,
          password: dept.smtp_password,
        },
      },
    });

    const fromAddress = senderName ? `"${senderName}" <${dept.smtp_email}>` : dept.smtp_email;

    const sendOptions: any = {
      from: fromAddress,
      to: to,
      subject: subject,
      content: "auto",
      html: html,
    };

    if (emailAttachments.length > 0) {
      sendOptions.attachments = emailAttachments;
    }

    await client.send(sendOptions);
    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMTP send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
