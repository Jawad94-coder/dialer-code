export type Message = {
  id: string;
  body: string;
  time: string;
  direction: "in" | "out";
  status?: string;
};

export type Conversation = {
  id: string;
  name: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  starred: boolean;
  status: "New" | "Open" | "Closed";
  messages: Message[];
};
