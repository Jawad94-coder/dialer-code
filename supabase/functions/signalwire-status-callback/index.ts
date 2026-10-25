import { serviceClient } from "../_shared/auth.ts";
import { verifySignalWireForm } from "../_shared/signalwire_signature.ts";
import { jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const form = new URLSearchParams(await request.text());
    if (!(await verifySignalWireForm(request, form, "SIGNALWIRE_STATUS_CALLBACK_URL"))) {
      return new Response("Invalid signature", { status: 403 });
    }

    const signalwireSid = form.get("MessageSid") ?? form.get("SmsSid");
    const status = form.get("MessageStatus") ?? form.get("SmsStatus");
    if (!signalwireSid || !status) return new Response("Missing message status fields", { status: 400 });

    const supabase = serviceClient();
    const { error: messageError } = await supabase
      .from("messages")
      .update({
        status,
        error_code: form.get("ErrorCode"),
        updated_at: new Date().toISOString(),
      })
      .eq("signalwire_sid", signalwireSid);
    if (messageError) {
      console.error("Unable to update SMS status:", messageError.message);
      return jsonResponse({ error: "Could not update message status." }, 500);
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("SignalWire status callback failed:", error);
    return jsonResponse({ error: "Status callback processing failed." }, 500);
  }
});
