import { requireUser, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse, preflight, requiredEnv } from "../_shared/http.ts";

type SendSmsBody = { conversation_id?: unknown; body?: unknown };

async function updateMessageStatus(supabase: ReturnType<typeof serviceClient>, id: string, status: string) {
  const { error } = await supabase.from("messages").update({ status }).eq("id", id);
  if (error) {
    console.error("Unable to record outbound message status:", error.message);
    return false;
  }
  return true;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const auth = await requireUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, 401);

  let payload: SendSmsBody;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (
    typeof payload.conversation_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.conversation_id) ||
    typeof payload.body !== "string" ||
    payload.body.trim().length === 0 ||
    payload.body.length > 1600
  ) {
    return jsonResponse({ error: "A valid conversation_id and message body (1–1600 characters) are required." }, 400);
  }

  let projectId: string;
  let token: string;
  let space: string;
  let callbackUrl: string;
  try {
    projectId = requiredEnv("SIGNALWIRE_PROJECT_ID");
    token = requiredEnv("SIGNALWIRE_API_TOKEN");
    space = requiredEnv("SIGNALWIRE_SPACE");
    callbackUrl = requiredEnv("SIGNALWIRE_STATUS_CALLBACK_URL");
    const spaceUrl = new URL(`https://${space}`);
    if (
      !/^[a-z0-9.-]+$/i.test(space) ||
      spaceUrl.hostname !== space ||
      !space.endsWith(".signalwire.com")
    ) throw new Error("Invalid SignalWire Space hostname.");
  } catch (error) {
    console.error("SignalWire server configuration is incomplete:", error);
    return jsonResponse({ error: "SignalWire is not configured on the server." }, 503);
  }

  const supabase = serviceClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,signalwire_number,contacts(phone)")
    .eq("id", payload.conversation_id)
    .maybeSingle();
  if (conversationError) {
    console.error("Unable to read conversation:", conversationError.message);
    return jsonResponse({ error: "Unable to load the selected conversation." }, 500);
  }
  if (!conversation) return jsonResponse({ error: "Conversation not found." }, 404);

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const recipient = contact?.phone;
  if (!recipient) return jsonResponse({ error: "Conversation has no valid recipient phone number." }, 422);

  const body = payload.body.trim();
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "out",
      body,
      status: "queued",
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("Unable to record outbound message:", insertError.message);
    return jsonResponse({ error: "Unable to queue the message." }, 500);
  }

  const credentials = btoa(`${projectId}:${token}`);
  const form = new URLSearchParams({
    From: conversation.signalwire_number,
    To: recipient,
    Body: body,
    StatusCallback: callbackUrl,
  });

  let providerResponse: Response;
  try {
    providerResponse = await fetch(
      `https://${space}/api/laml/2010-04-01/Accounts/${encodeURIComponent(projectId)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
  } catch (error) {
    const statusRecorded = await updateMessageStatus(supabase, message.id, "unknown");
    console.error("SignalWire request failed:", error);
    return jsonResponse({
      error: statusRecorded
        ? "SignalWire did not return a response. Delivery is uncertain; refresh and check SignalWire logs before retrying."
        : "SignalWire did not return a response and the message status could not be saved. Check SignalWire logs before retrying.",
      delivery_uncertain: true,
      message_id: message.id,
    }, 502);
  }

  const responseText = await providerResponse.text();
  let providerMessage: { sid?: string; status?: string };
  try {
    providerMessage = JSON.parse(responseText);
  } catch {
    const statusRecorded = await updateMessageStatus(supabase, message.id, "unknown");
    console.error("SignalWire returned a non-JSON response:", providerResponse.status);
    return jsonResponse({
      error: statusRecorded
        ? "SignalWire returned an invalid response. Delivery is uncertain; refresh and check SignalWire logs before retrying."
        : "SignalWire returned an invalid response and the message status could not be saved. Check SignalWire logs before retrying.",
      delivery_uncertain: true,
      message_id: message.id,
    }, 502);
  }

  if (!providerResponse.ok || !providerMessage.sid) {
    const status = providerResponse.ok || providerResponse.status >= 500 ? "unknown" : "failed";
    const statusRecorded = await updateMessageStatus(supabase, message.id, status);
    console.error("SignalWire rejected SMS:", providerResponse.status);
    const uncertain = status === "unknown";
    return jsonResponse({
      error: uncertain
        ? "SignalWire response was inconclusive. Refresh and check SignalWire logs before retrying."
        : "SignalWire rejected the message. Check server configuration and sender number.",
      delivery_uncertain: uncertain,
      status_recorded: statusRecorded,
      message_id: message.id,
    }, 502);
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("messages")
    .update({
      signalwire_sid: providerMessage.sid,
      status: providerMessage.status || "queued",
      updated_at: sentAt,
    })
    .eq("id", message.id);
  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({
      last_message_preview: body,
      last_message_at: sentAt,
      last_message_direction: "out",
      unread: false,
      updated_at: sentAt,
    })
    .eq("id", conversation.id);
  if (updateError || conversationUpdateError) {
    console.error("SMS sent but database update failed:", updateError?.message, conversationUpdateError?.message);
    return jsonResponse({ error: "Message sent, but the inbox record could not be updated. Refresh before retrying." }, 500);
  }

  return new Response(JSON.stringify({
    id: message.id,
    body,
    direction: "out",
    status: providerMessage.status || "queued",
    time: sentAt,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
