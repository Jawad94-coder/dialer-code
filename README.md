# Loadlink SMS Inbox

A responsive React + TypeScript inbox based on the supplied screenshot, with a Supabase Edge Functions backend and SignalWire SMS callbacks.

## Local frontend

1. Install Node.js and npm.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_ANON_KEY` to the Supabase project's public anon/publishable key. It is intended for browser use; never put a service-role key or SignalWire credential in a `VITE_*` variable.
4. Run `npm install` and `npm run dev`.

Create a production build with `npm run build`.

To review the screenshot UI without connecting to Supabase, start `npm run dev` and open `http://localhost:5173/?preview=1`. This development-only preview uses fictional sample data, supports local inbox filters and starring, and disables all messaging. The preview query is ignored in production builds.

## Supabase setup

The Supabase project reference in the supplied function URLs is `sllxhrmknyhhwdhxvwkh`. The backend source is in `supabase/`:

- Migration creates contacts, conversations and messages, with row-level security enabled and direct browser table access revoked.
- `conversations`, `messages`, `send-sms`, and `update-conversation` require a valid Supabase session and a trusted user's `app_metadata.messaging_access` flag set to `true`.
- `signalwire-sms-webhook` and `signalwire-status-callback` validate SignalWire's `X-SignalWire-Signature` using the project's Signing Key.
- The inbound webhook stores received SMS. The status callback updates outbound delivery status.
- Outbound SMS is sent from the Edge Function using the SignalWire Compatibility API; credentials remain server-side.

Before deploying:

1. In Supabase Auth, provision accounts only for approved team members. Set `app_metadata.messaging_access` to `true` for each approved user. Do not add this flag to `user_metadata`; users can edit their own user metadata.
2. Set Edge Function secrets in the Supabase Dashboard (Project Settings / Edge Functions / Secrets) or through a secure local secrets workflow:
   - `SIGNALWIRE_SPACE=loadlinkdispatching.signalwire.com`
   - `SIGNALWIRE_PROJECT_ID` (SignalWire Project ID)
   - `SIGNALWIRE_API_TOKEN` (API token with the Messaging scope)
   - `SIGNALWIRE_SIGNING_KEY` (SignalWire API Credentials / Signing Key; distinct from the API token)
   - `SIGNALWIRE_SMS_WEBHOOK_URL=https://sllxhrmknyhhwdhxvwkh.supabase.co/functions/v1/signalwire-sms-webhook`
   - `SIGNALWIRE_STATUS_CALLBACK_URL=https://sllxhrmknyhhwdhxvwkh.supabase.co/functions/v1/signalwire-status-callback`
   - `APP_ORIGIN=http://localhost:5173` for local development; use the exact production origin when deployed.
3. Use the Supabase CLI linked to project `sllxhrmknyhhwdhxvwkh` to apply the migration (`supabase db push`) and deploy the functions (`supabase functions deploy`). Deploying the two callback functions replaces the implementations currently configured at those URLs.
4. Confirm the SignalWire messaging script points to the inbound webhook URL above with `POST`. The outbound function sets the status callback URL when it sends an SMS.
5. Copy the Supabase public URL and anon/publishable key to the local `.env` for the frontend. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, SignalWire API credentials, or the Signing Key.

Run end-to-end tests with an approved Supabase Auth user and a SignalWire-enabled number. Incoming SMS should create/update a conversation; outbound SMS should record a queued message and later receive status updates. SignalWire callbacks are best-effort, so a missing status callback does not necessarily mean the SMS was not sent.

SignalWire reference docs: [Compatibility API create message](https://signalwire.com/docs/compatibility-api/rest/messages/create-message) and [webhook signature validation](https://signalwire.com/docs/compatibility-api/guides/webhook-security).

## Scope

This integration covers SMS inbox, inbound SMS, outbound SMS, and message status. Voice calling, MMS, bulk import/export, and contact assignment are not wired to a backend yet; those UI controls remain disabled or presentational.
