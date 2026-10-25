import type { Conversation } from "../types";

export const previewConversations: Conversation[] = [
  {
    id: "demo-alex",
    name: "Alex Morgan",
    phone: "+1 (555) 010-2045",
    preview: "I am fine, what about you?",
    time: new Date(Date.now() - 2 * 60_000).toISOString(),
    unread: false,
    starred: true,
    status: "New",
    messages: [
      { id: "demo-alex-in", body: "Hello Alex, how are you?", time: new Date(Date.now() - 4 * 60_000).toISOString(), direction: "in" },
      { id: "demo-alex-out", body: "I am fine, what about you?", time: new Date(Date.now() - 2 * 60_000).toISOString(), direction: "out", status: "delivered" },
    ],
  },
  {
    id: "demo-jamie",
    name: "New contact",
    phone: "+1 (555) 010-3875",
    preview: "Hi, how can I assist you today?",
    time: new Date(Date.now() - 12 * 60_000).toISOString(),
    unread: true,
    starred: false,
    status: "Open",
    messages: [
      { id: "demo-jamie-in", body: "Hi, how can I assist you today?", time: new Date(Date.now() - 12 * 60_000).toISOString(), direction: "in" },
    ],
  },
  {
    id: "demo-dispatch",
    name: "Dispatch team",
    phone: "+1 (555) 010-1800",
    preview: "The pickup is confirmed for tomorrow.",
    time: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    unread: false,
    starred: false,
    status: "Open",
    messages: [
      { id: "demo-dispatch-in", body: "The pickup is confirmed for tomorrow.", time: new Date(Date.now() - 24 * 60 * 60_000).toISOString(), direction: "in" },
    ],
  },
];
