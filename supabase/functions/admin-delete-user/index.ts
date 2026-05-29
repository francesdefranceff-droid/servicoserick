import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração do backend ausente" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    const caller = callerData?.user;
    if (callerError || !caller) return json({ error: "Sessão inválida" }, 401);

    const { data: callerRole, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) return json({ error: roleError.message }, 500);
    if (!callerRole) return json({ error: "Acesso negado" }, 403);

    const { userId } = await req.json();
    if (typeof userId !== "string" || !userId) {
      return json({ error: "Usuário inválido" }, 400);
    }
    if (userId === caller.id) {
      return json({ error: "Você não pode apagar seu próprio usuário admin" }, 400);
    }

    const { data: conversations, error: conversationsError } = await admin
      .from("svc_conversations")
      .select("id")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    if (conversationsError) return json({ error: conversationsError.message }, 500);

    const conversationIds = (conversations ?? [])
      .map((conversation) => conversation.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const deleteSteps = [
      ...(conversationIds.length
        ? [admin.from("svc_messages").delete().in("conversation_id", conversationIds)]
        : []),
      admin.from("svc_messages").delete().eq("sender_id", userId),
      admin.from("svc_conversations").delete().or(`user_a.eq.${userId},user_b.eq.${userId}`),
      admin.from("svc_subscriptions").delete().eq("user_id", userId),
      admin.from("svc_posts").delete().eq("user_id", userId),
      admin.from("svc_profiles").delete().eq("user_id", userId),
      admin.from("user_roles").delete().eq("user_id", userId),
    ];

    for (const step of deleteSteps) {
      const { error } = await step;
      if (error) return json({ error: error.message }, 500);
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) return json({ error: authDeleteError.message }, 500);

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
