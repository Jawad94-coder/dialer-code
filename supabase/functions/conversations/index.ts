import { requireUser, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse, preflight } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);

  const auth = await requireUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, 401);

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,status,unread,starred,last_message_preview,last_message_at,last_message_direction,contacts(display_name,phone)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Unable to load conversations:", error.message);
    return jsonResponse({ error: "Unable to load conversations." }, 500);
  }

  const result = (data ?? []).map((conversation) => {
    const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
    return {
      id: conversation.id,
      name: contact?.display_name || contact?.phone || "Unknown contact",
      phone: contact?.phone ?? "",
      preview: conversation.last_message_preview,
      time: conversation.last_message_at,
      unread: conversation.unread,
      starred: conversation.starred,
      status: conversation.status,
      messages: [],
    };
  });
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
