// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const UPLOAD_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";

function ghHeaders(extra: Record<string, string> = {}) {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const DRIVE = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!DRIVE) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return {
    Authorization: `Bearer ${LOVABLE}`,
    "X-Connection-Api-Key": DRIVE,
    ...extra,
  };
}

async function jsonOrThrow(r: Response, label: string) {
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${label} [${r.status}]: ${t}`);
  }
  return r.json();
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = String(body.action || "");

    let data: any;

    switch (action) {
      case "list": {
        const params = new URLSearchParams();
        const folderId = body.folderId || "root";
        const queryParts: string[] = [`'${folderId}' in parents`, "trashed=false"];
        if (body.q) {
          const q = String(body.q).replace(/'/g, "\\'");
          queryParts.push(`name contains '${q}'`);
        }
        params.set("q", queryParts.join(" and "));
        params.set(
          "fields",
          "nextPageToken, files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink,thumbnailLink,parents)",
        );
        params.set("pageSize", String(body.pageSize || 100));
        params.set("orderBy", body.orderBy || "folder,name");
        if (body.pageToken) params.set("pageToken", body.pageToken);
        const r = await fetch(`${DRIVE_GATEWAY}/files?${params}`, { headers: ghHeaders() });
        data = await jsonOrThrow(r, "list");
        break;
      }

      case "get": {
        const id = body.fileId;
        const r = await fetch(
          `${DRIVE_GATEWAY}/files/${id}?fields=id,name,mimeType,size,modifiedTime,parents,webViewLink`,
          { headers: ghHeaders() },
        );
        data = await jsonOrThrow(r, "get");
        break;
      }

      case "download": {
        const id = body.fileId;
        const r = await fetch(`${DRIVE_GATEWAY}/files/${id}?alt=media`, {
          headers: ghHeaders(),
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`download [${r.status}]: ${t}`);
        }
        const buf = new Uint8Array(await r.arrayBuffer());
        data = {
          base64: bytesToB64(buf),
          mimeType: r.headers.get("content-type") || "application/octet-stream",
          size: buf.byteLength,
        };
        break;
      }

      case "upload": {
        const { name, mimeType, parents, base64 } = body;
        if (!name || !base64) throw new Error("name and base64 required");
        const bytes = b64ToBytes(base64);
        const boundary = "lovable_boundary_" + crypto.randomUUID().replace(/-/g, "");
        const meta: any = { name };
        if (parents) meta.parents = Array.isArray(parents) ? parents : [parents];
        if (mimeType) meta.mimeType = mimeType;
        const enc = new TextEncoder();
        const head = enc.encode(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
          `--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
        );
        const tail = enc.encode(`\r\n--${boundary}--`);
        const payload = new Uint8Array(head.length + bytes.length + tail.length);
        payload.set(head, 0);
        payload.set(bytes, head.length);
        payload.set(tail, head.length + bytes.length);
        const r = await fetch(`${UPLOAD_GATEWAY}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,parents`, {
          method: "POST",
          headers: ghHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
          body: payload,
        });
        data = await jsonOrThrow(r, "upload");
        break;
      }

      case "createFolder": {
        const { name, parents } = body;
        const r = await fetch(`${DRIVE_GATEWAY}/files?fields=id,name,mimeType,modifiedTime,parents`, {
          method: "POST",
          headers: ghHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: parents ? (Array.isArray(parents) ? parents : [parents]) : undefined,
          }),
        });
        data = await jsonOrThrow(r, "createFolder");
        break;
      }

      case "rename": {
        const { fileId, name } = body;
        const r = await fetch(`${DRIVE_GATEWAY}/files/${fileId}?fields=id,name`, {
          method: "PATCH",
          headers: ghHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ name }),
        });
        data = await jsonOrThrow(r, "rename");
        break;
      }

      case "move": {
        const { fileId, addParents, removeParents } = body;
        const params = new URLSearchParams();
        if (addParents) params.set("addParents", Array.isArray(addParents) ? addParents.join(",") : addParents);
        if (removeParents) params.set("removeParents", Array.isArray(removeParents) ? removeParents.join(",") : removeParents);
        params.set("fields", "id,name,parents");
        const r = await fetch(`${DRIVE_GATEWAY}/files/${fileId}?${params}`, {
          method: "PATCH",
          headers: ghHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        data = await jsonOrThrow(r, "move");
        break;
      }

      case "delete": {
        // Admin-only check
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: userData.user.id, _role: "admin",
        });
        if (!isAdmin) {
          return new Response(JSON.stringify({ ok: false, error: "Apenas admins podem excluir." }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { fileId } = body;
        const r = await fetch(`${DRIVE_GATEWAY}/files/${fileId}?supportsAllDrives=true`, {
          method: "DELETE",
          headers: ghHeaders(),
        });
        if (!r.ok && r.status !== 204) {
          const t = await r.text();
          throw new Error(`delete [${r.status}]: ${t}`);
        }
        data = { deleted: true };
        break;
      }

      case "breadcrumb": {
        // Resolve parent chain for a given folder id
        const ids: string[] = [];
        const names: string[] = [];
        let cur = body.folderId;
        for (let i = 0; i < 10 && cur && cur !== "root"; i++) {
          const r = await fetch(`${DRIVE_GATEWAY}/files/${cur}?fields=id,name,parents`, { headers: ghHeaders() });
          if (!r.ok) break;
          const f = await r.json();
          ids.unshift(f.id);
          names.unshift(f.name);
          cur = f.parents?.[0];
        }
        data = { ids, names };
        break;
      }

      default:
        throw new Error(`unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("drive-api error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});