import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("batch update tax regime - small batch", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/batch-update-tax-regime?limit=3&offset=0`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  
  const body = await res.text();
  console.log("Response status:", res.status);
  console.log("Response body:", body);
  
  assertEquals(res.status, 200);
  
  const data = JSON.parse(body);
  console.log("Processed:", data.processed);
  console.log("Updated:", data.updated);
  console.log("Skipped:", data.skipped);
  console.log("Errors:", data.errors);
});
