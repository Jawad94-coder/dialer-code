import type { Conversation, Message } from "../types";
import { supabase } from "./supabase";

async function throwFunctionError(error: Error & { context?: unknown }): Promise<never> {
  if (error.context instanceof Response) {
    let payload: unknown;
    try {
      payload = await error.context.clone().json();
    } catch {
      throw new Error(error.message);
    }
    if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
      throw new Error(payload.error);
    }
  }
  throw new Error(error.message);
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await client().functions.invoke<Conversation[]>("conversations", {
    method: "GET",
  });
  if (error) return throwFunctionError(error);
  return data ?? [];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await client().functions.invoke<Message[]>("messages", {
    body: { conversation_id: conversationId },
  });
  if (error) return throwFunctionError(error);
  return data ?? [];
}

export async function sendSms(conversationId: string, body: string): Promise<Message> {
  const { data, error } = await client().functions.invoke<Message>("send-sms", {
    body: { conversation_id: conversationId, body },
  });
  if (error) return throwFunctionError(error);
  if (!data) throw new Error("The send endpoint returned an empty response.");
  return data;
}

export async function updateConversation(conversationId: string, action: "mark_read" | "toggle_star") {
  const { data, error } = await client().functions.invoke<{ id: string; unread: boolean; starred: boolean }>(
    "update-conversation",
    { body: { conversation_id: conversationId, action } },
  );
  if (error) return throwFunctionError(error);
  if (!data) throw new Error("The conversation update returned an empty response.");
  return data;
}
