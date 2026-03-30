import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.test("send email via smtp-send", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/smtp-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      departmentId: "af36437e-da3d-4c6e-bd71-e6584fa96843",
      to: "atende.velocita@gmail.com",
      subject: "Folha de Pagamento março de 2026",
      html: '<div style="font-family: sans-serif; white-space: pre-wrap;">Olá!\n\nSegue documentos da Folha de Pagamento referente ao mês março de 2026.\n\nAtt,\n</div>',
    }),
  });

  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response body:", JSON.stringify(data));
  assertEquals(res.status, 200);
});
