import { requiredEnv } from "./http.ts";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifySignalWireForm(
  request: Request,
  form: URLSearchParams,
  callbackUrlEnv: string,
): Promise<boolean> {
  const signature = request.headers.get("X-SignalWire-Signature");
  if (!signature) return false;

  const callbackUrl = requiredEnv(callbackUrlEnv);
  const keys = [...new Set([...form.keys()])].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const signedPayload = callbackUrl + keys
    .map((key) => `${key}${form.getAll(key).sort().join("")}`)
    .join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredEnv("SIGNALWIRE_SIGNING_KEY")),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = new TextEncoder().encode(toBase64(new Uint8Array(digest)));
  const provided = new TextEncoder().encode(signature);
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ provided[index];
  return difference === 0;
}
