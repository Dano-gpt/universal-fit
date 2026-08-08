// Supabase Edge Function: admin-impersonate
// Permite que el admin de Universal Fit se apersone como un entrenador o alumno,
// generando un magic link y devolviendo el hashed_token para verifyOtp en el cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_UID = "ac05eb3e-5679-4ac2-9dae-3c54fac2cdf6";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function resolveKey(directEnvName: string, dictEnvName: string): string {
  const direct = Deno.env.get(directEnvName);
  if (direct) return direct;
  try {
    const raw = Deno.env.get(dictEnvName);
    if (raw) {
      const dict = JSON.parse(raw);
      const val = dict.default || Object.values(dict)[0];
      if (val) return val as string;
    }
  } catch (_e) {}
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

           const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = resolveKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
  const SERVICE_KEY = resolveKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  const authHeader = req.headers.get("Authorization") || "";

           if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
             return json({ ok: false, error: "missing_env" }, 500);
           }

           const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
             global: { headers: { Authorization: authHeader } },
           });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData || !callerData.user) return json({ ok: false, error: "no_auth" }, 401);
  if (callerData.user.id !== ADMIN_UID) return json({ ok: false, error: "not_admin" }, 403);

           let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ ok: false, error: "bad_body" }, 400);
  }

           const kind = body.kind === "al" ? "al" : body.kind === "pt" ? "pt" : null;
  const id = (body.id || "").trim();
  if (!kind || !id) return json({ ok: false, error: "bad_params" }, 400);

           const admin = createClient(SUPABASE_URL, SERVICE_KEY);

           let targetUid: string | null = null;
  if (kind === "pt") {
    targetUid = id;
  } else {
    const { data: row, error } = await admin.from("v1_students").select("user_uid").eq("id", id).maybeSingle();
    if (error) return json({ ok: false, error: "db_error" }, 500);
    if (!row || !row.user_uid) return json({ ok: false, reason: "no_account" });
    targetUid = row.user_uid;
  }

           if (!targetUid || targetUid === ADMIN_UID) return json({ ok: false, error: "invalid_target" }, 400);

           const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(targetUid);
  if (userErr || !userRes || !userRes.user || !userRes.user.email) {
    return json({ ok: false, error: "target_not_found" }, 404);
  }
  const email = userRes.user.email;

           const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !linkData || !linkData.properties || !linkData.properties.hashed_token) {
    return json({ ok: false, error: (linkErr && linkErr.message) || "link_error" }, 500);
  }

           try {
             await admin.from("admin_impersonation_log").insert({ admin_uid: callerData.user.id, target_uid: targetUid, target_kind: kind, target_email: email });
           } catch (_e) {}

           return json({ ok: true, email, hashed_token: linkData.properties.hashed_token });
});
