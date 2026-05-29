import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const email = "admin@pertodemim.app";
    const password = "Admin@2026!";

    // Try create
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Admin" },
    });

    let userId = created?.user?.id;
    if (createErr && !userId) {
      // Already exists - find user and update password
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email === email);
      if (!found) throw createErr;
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }

    // Ensure admin role
    if (userId) {
      await admin.from("user_roles").upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
