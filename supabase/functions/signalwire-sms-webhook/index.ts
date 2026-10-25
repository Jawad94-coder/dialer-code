import { serviceClient } from "../_shared/auth.ts";
import { verifySignalWireForm } from "../_shared/signalwire_signature.ts";
import { jsonResponse } from "../_shared/http.ts";
import { normalizePhone } from "../_shared/phone.ts";

function webhookResponse(status: number, message: string) {
  const xml = message ? `<Response><Message>${message}</Message></Response>` : "<Response></Response>";
  return new Response(xml, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return webhookResponse(405, "Method not allowed");

  try {
    const form = new URLSearchParams(await request.text());
    if (!(await verifySignalWireForm(request, form, "SIGNALWIRE_SMS_WEBHOOK_URL"))) {
      return webhookResponse(403, "Invalid signature");
    }

    const signalwireSid = form.get("MessageSid") ?? form.get("SmsSid");
    const from = normalizePhone(form.get("From") ?? "");
    const to = normalizePhone(form.get("To") ?? "");
    const body = form.get("Body") ?? "";
    if (!signalwireSid || !from || !to) {
      return webhookResponse(400, "Missing or invalid message fields");
    }

    const supabase = serviceClient();
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .upsert({ phone: from, updated_at: new Date().toISOString() }, { onConflict: "phone" })
      .select("id")
      .single();
    if (contactError) {
      console.error("Unable to save inbound SMS contact:", contactError.message);
      return webhookResponse(500, "Could not save contact");
    }

    const { data: conversationId, error: conversationError } = await supabase.rpc("upsert_sms_conversation", {
      p_contact_id: contact.id,
      p_signalwire_number: to,
      p_body: body,
      p_direction: "in",
    });
    if (conversationError || !conversationId) {
      console.error("Unable to save inbound SMS conversation:", conversationError?.message);
      return webhookResponse(500, "Could not save conversation");
    }

    const { error: messageError } = await supabase
      .from("messages")
      .upsert({
        conversation_id: conversationId,
        signalwire_sid: signalwireSid,
        direction: "in",
        body,
        status: form.get("SmsStatus") ?? "received",
        updated_at: new Date().toISOString(),
      }, { onConflict: "signalwire_sid" });
    if (messageError) {
      console.error("Unable to save inbound SMS:", messageError.message);
      return webhookResponse(500, "Could not save message");
    }

    return webhookResponse(200, "");
  } catch (error) {
    console.error("SignalWire SMS webhook failed:", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return jsonResponse({ error: message }, 500);
  }
});
