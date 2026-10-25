import { requireUser, serviceClient } from "../_shared/auth.ts";
import { jsonResponse, preflight } from "../_shared/http.ts";

type UpdateRequest = {
  conversation_id?: unknown;
  action?: unknown;
};

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const auth = await requireUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, 401);

  let payload: UpdateRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (
    typeof payload.conversation_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.conversation_id) ||
    (payload.action !== "mark_read" && payload.action !== "toggle_star")
  ) {
    return jsonResponse({ error: "A valid conversation_id and action are required." }, 400);
  }

  const supabase = serviceClient();
  const { data: existing, error: readError } = await supabase
    .from("conversations")
    .select("id,unread,starred")
    .eq("id", payload.conversation_id)
    .maybeSingle();
  if (readError) {
    console.error("Unable to read conversation state:", readError.message);
    return jsonResponse({ error: "Unable to update conversation." }, 500);
  }
  if (!existing) return jsonResponse({ error: "Conversation not found." }, 404);

  const changes = payload.action === "mark_read"
    ? { unread: false }
    : { starred: !existing.starred };
  const { data, error } = await supabase
    .from("conversations")
    .update(changes)
    .eq("id", existing.id)
    .select("id,unread,starred")
    .single();
  if (error) {
    console.error("Unable to update conversation state:", error.message);
    return jsonResponse({ error: "Unable to update conversation." }, 500);
  }
  return jsonResponse(data);
});
