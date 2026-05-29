const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a Sofia, uma assistente IA generalista, criativa e produtiva, em português brasileiro.

Você ajuda o usuário em QUALQUER tarefa, incluindo:
- Criar currículos completos (formato texto e em HTML pronto para imprimir)
- Criar sites/landing pages completos em HTML + CSS (Tailwind via CDN) inline em um único arquivo, prontos para copiar e colar
- Escrever cartas, e-mails, mensagens, posts, descrições de produto, propostas comerciais
- Planejar viagens, eventos, estudos, projetos
- Explicar conceitos, traduzir, revisar texto, resumir
- Gerar ideias, nomes de marca, slogans, roteiros, planos de negócio
- Ajudar com código (qualquer linguagem)

REGRAS:
- Sempre responda em Markdown bem formatado, com títulos, listas, blocos de código (\`\`\`) quando entregar HTML, código, currículo, etc.
- Quando o usuário pedir currículo/site/código, ENTREGUE o artefato pronto, completo, sem placeholders, dentro de um bloco de código.
- Seja direta e útil. Faça no máximo 1 pergunta de esclarecimento só se for indispensável.
- Português brasileiro natural e caloroso.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages)
      ? body.messages
      : body.message
        ? [{ role: "user", content: String(body.message) }]
        : null;

    if (!messages) {
      return new Response(JSON.stringify({ error: "messages ou message obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m: any) => ({
            role: m.role === "ai" ? "assistant" : m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: text }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
