import { requireUser, serviceClient } from "../_shared/auth.ts";
import { jsonResponse, preflight } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const auth = await requireUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, 401);

  let payload: { conversation_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const conversationId = payload.conversation_id;
  if (typeof conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return jsonResponse({ error: "A valid conversation_id is required." }, 400);
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id,body,direction,status,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("Unable to load messages:", error.message);
    return jsonResponse({ error: "Unable to load messages." }, 500);
  }
  return jsonResponse((data ?? []).map((message) => ({
    id: message.id,
    body: message.body,
    direction: message.direction,
    status: message.status,
    time: message.created_at,
  })));
});
