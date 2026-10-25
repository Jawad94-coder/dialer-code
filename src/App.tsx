import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Headphones,
  Image,
  Inbox,
  LayoutGrid,
  LoaderCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import AuthScreen from "./components/AuthScreen";
import { getConversations, getMessages, sendSms, updateConversation } from "./lib/messaging";
import { previewConversations } from "./lib/preview-data";
import { supabase, supabaseConfigError } from "./lib/supabase";
import type { Conversation, Message } from "./types";

const navigation = [
  { label: "Conversations", icon: Inbox, active: true },
  { label: "Number selection", icon: Phone },
  { label: "Bulk import / export", icon: ArrowDownToLine },
  { label: "Confirmed leads", icon: Check },
];

const railItems = [
  { label: "Downloads", icon: ArrowDownToLine },
  { label: "Search", icon: Search },
  { label: "Contacts", icon: UserRound },
  { label: "Team inbox", icon: UsersRound, active: true },
  { label: "Automation", icon: Zap },
  { label: "Media", icon: Image },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function displayTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function App() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>(previewMode ? previewConversations : []);
  const [selectedId, setSelectedId] = useState<string | null>(previewMode ? previewConversations[0]?.id ?? null : null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [contactTab, setContactTab] = useState("Details");
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Unable to restore your session.");
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setConversations([]);
        setSelectedId(null);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getConversations().then((items) => {
      if (!active) return;
      setConversations(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Unable to load conversations.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session || !selectedId) return;
    let active = true;
    setSendError(null);
    updateConversation(selectedId, "mark_read").then((state) => {
      if (active) {
        setConversations((current) => current.map((conversation) =>
          conversation.id === selectedId ? { ...conversation, unread: state.unread } : conversation,
        ));
      }
    }).catch((error: unknown) => {
      if (active) setSendError(error instanceof Error ? error.message : "Unable to mark conversation as read.");
    });
    getMessages(selectedId).then((messages) => {
      if (!active) return;
      setConversations((current) => current.map((conversation) =>
        conversation.id === selectedId ? { ...conversation, messages } : conversation,
      ));
    }).catch((error: unknown) => {
      if (active) setSendError(error instanceof Error ? error.message : "Unable to load messages.");
    });
    return () => { active = false; };
  }, [session, selectedId]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesFilter =
        filter === "All" ||
        (filter === "Unread" && conversation.unread) ||
        (filter === "Recent" && Date.now() - Date.parse(conversation.time) < 7 * 24 * 60 * 60 * 1000) ||
        (filter === "Starred" && conversation.starred);
      const matchesSearch =
        normalizedQuery.length === 0 ||
        `${conversation.name} ${conversation.phone} ${conversation.preview}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesSearch;
    });
  }, [conversations, filter, query]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim() || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      const sent: Message = await sendSms(selected.id, draft);
      setConversations((current) => current.map((conversation) =>
        conversation.id === selected.id
          ? { ...conversation, preview: sent.body, time: sent.time, messages: [...conversation.messages, sent] }
          : conversation,
      ));
      setDraft("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setLoadError(error.message);
  }

  async function refreshInbox() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getConversations();
      setConversations((current) => items.map((item) => ({
        ...item,
        messages: current.find((conversation) => conversation.id === item.id)?.messages ?? [],
      })));
      const activeId = selectedId && items.some((item) => item.id === selectedId) ? selectedId : items[0]?.id ?? null;
      setSelectedId(activeId);
      if (activeId) {
        const messages = await getMessages(activeId);
        setConversations((current) => current.map((item) => item.id === activeId ? { ...item, messages } : item));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to refresh conversations.");
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return <main className="auth-screen"><div className="auth-loading"><LoaderCircle size={22} className="spin" /> Checking your session…</div></main>;
  }
  if (!session && !previewMode) return <AuthScreen configurationError={supabaseConfigError} />;

  async function toggleStar(id: string) {
    if (previewMode) {
      setConversations((current) => current.map((conversation) =>
        conversation.id === id ? { ...conversation, starred: !conversation.starred } : conversation,
      ));
      return;
    }
    try {
      const state = await updateConversation(id, "toggle_star");
      setConversations((current) => current.map((conversation) =>
        conversation.id === id ? { ...conversation, starred: state.starred } : conversation,
      ));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to update conversation.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Loadlink home">
          <span className="brand-mark"><Building2 size={19} strokeWidth={2.5} /></span>
          <span>Loadlink</span>
        </a>

        <button className="location-switcher">
          <span className="location-pin"><Building2 size={17} /></span>
          <span className="location-copy">
            <strong>Loadlink Dispatch</strong>
            <span>Mississauga, Ontario</span>
          </span>
          <ChevronDown size={16} />
        </button>

        <label className="sidebar-search">
          <Search size={17} />
          <input ref={searchInputRef} aria-label="Search conversations" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>Ctrl K</kbd>
          <button aria-label="Quick actions"><Zap size={17} fill="currentColor" /></button>
        </label>

        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
              {label === "Conversations" && <span className="nav-count">{conversations.filter((conversation) => conversation.unread).length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item"><Settings2 size={18} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={18} /><span>Help center</span></button>
          <div className="workspace-card">
            <div className="workspace-avatar">LD</div>
            <div><strong>Loadlink Dispatch</strong><span>Team workspace</span></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Building2 size={18} /></span> Loadlink</div>
          <div className="page-heading"><span className="eyebrow">MESSAGING</span><h1>Conversations</h1></div>
          <div className="top-actions">
            <span className={`preview-badge ${previewMode ? "" : "live"}`}><span />{previewMode ? "Local demo · no live SMS" : "SMS inbox"}</span>
            <button className="icon-button" aria-label="Support"><Headphones size={19} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button>
            <button className="profile-button" aria-label={session ? "Sign out" : "Preview mode"} title={session ? `Sign out ${session.user.email ?? ""}` : "Development preview"} onClick={session ? signOut : undefined}>J</button>
          </div>
        </header>

        <section className={`inbox-layout ${mobileThreadOpen ? "thread-open" : ""}`}>
          <nav className="icon-rail" aria-label="Inbox tools">
            {railItems.map(({ label, icon: Icon, active }) => (
              <button key={label} className={`rail-button ${active ? "active" : ""}`} title={label} aria-label={label}>
                <Icon size={19} />
              </button>
            ))}
            <div className="rail-divider" />
            <button className="rail-button" title="Help" aria-label="Help"><CircleHelp size={19} /></button>
            <button className="rail-collapse" aria-label="Collapse navigation"><ChevronLeft size={15} /></button>
          </nav>

          <section className="conversation-list">
            <div className="list-header">
              <div className="inbox-heading">
                <div className="orange-icon"><UsersRound size={19} /></div>
                <div><h2>Team inbox</h2><span>{conversations.length} conversations</span></div>
              </div>
              <button className="number-select">All numbers <ChevronDown size={15} /></button>
            </div>
            {loadError && <div className="inline-error" role="alert"><AlertCircle size={15} />{loadError}</div>}
            <div className="list-tools">
              <label className="list-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
              <button className="filter-button" aria-label="Refresh inbox" title="Refresh inbox and message status" onClick={refreshInbox} disabled={isLoading || previewMode}><RefreshCw size={16} className={isLoading ? "spin" : ""} /></button>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Conversation filters">
              {[
                { name: "Unread", icon: Inbox },
                { name: "All", icon: LayoutGrid },
                { name: "Recent", icon: Clock3 },
                { name: "Starred", icon: Star },
              ].map(({ name, icon: Icon }) => (
                <button key={name} role="tab" aria-selected={filter === name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>
                  <Icon size={17} /><span>{name}</span>
                </button>
              ))}
            </div>
            <div className="conversation-items">
              {isLoading && <div className="list-loading"><LoaderCircle size={18} className="spin" />Loading conversations…</div>}
              {!isLoading && filteredConversations.map((conversation) => (
                <div key={conversation.id} className={`conversation-item ${selectedId === conversation.id ? "selected" : ""}`}>
                  <button
                    type="button"
                    className="conversation-select"
                    aria-pressed={selectedId === conversation.id}
                    onClick={() => { setSelectedId(conversation.id); setMobileThreadOpen(true); }}
                  >
                    <div className="avatar">{initials(conversation.name)}</div>
                    <div className="conversation-summary">
                      <div className="conversation-line"><strong>{conversation.name}</strong><time>{displayTime(conversation.time)}</time></div>
                      <p>{conversation.preview}</p>
                      <span className="conversation-phone">{conversation.phone}</span>
                    </div>
                  </button>
                  <span className="item-actions">
                    {conversation.unread && <i className="unread-dot" />}
                    <button
                      type="button"
                      aria-label={conversation.starred ? "Unstar conversation" : "Star conversation"}
                      onClick={() => toggleStar(conversation.id)}
                    ><Star size={15} fill={conversation.starred ? "currentColor" : "none"} /></button>
                  </span>
                </div>
              ))}
              {!isLoading && filteredConversations.length === 0 && <div className="empty-list"><Search size={20} /><strong>{loadError ? "Inbox unavailable" : "No conversations found"}</strong><span>{loadError ? "Check your Supabase setup and try again." : "New inbound messages will appear here."}</span></div>}
            </div>
            <button className="new-message-button" disabled title="Start a conversation after an inbound SMS is received"><Plus size={17} /> New conversation</button>
          </section>

          <section className="thread-panel" aria-label="Conversation thread">
            {selected ? (
              <>
                <header className="thread-header">
                  <button className="icon-button mobile-back" aria-label="Back to conversations" onClick={() => setMobileThreadOpen(false)}><ChevronLeft size={19} /></button>
                  <div className="thread-contact">
                    <div className="avatar">{initials(selected.name)}</div>
                    <div><h2>{selected.name}</h2><span>{selected.phone}</span></div>
                  </div>
                  <div className="thread-actions">
                    <button className="icon-button" title="Voice calling is not configured" aria-label="Call contact" disabled><Phone size={18} /></button>
                    <span className="header-separator" />
                    <button className={`status-pill status-${selected.status.toLowerCase()}`} disabled title="Conversation status editing is not configured">{selected.status}<ChevronDown size={15} /></button>
                    <button className="icon-button more-thread" aria-label="More conversation actions"><MoreHorizontal size={20} /></button>
                  </div>
                </header>

                <div className="thread-content">
                  <div className="date-divider"><span>Today</span></div>
                  {selected.messages.length === 0 && <div className="thread-empty"><Inbox size={21} /><span>No messages in this conversation yet.</span></div>}
                  <div className="message-stack">
                    {selected.messages.map((item) => (
                      <div key={item.id} className={`message-row ${item.direction === "out" ? "outgoing" : ""}`}>
                        {item.direction === "in" && <div className="message-avatar">{initials(selected.name)}</div>}
                        <div className="message-group">
                          <div className={`message-bubble ${item.direction === "out" ? "outgoing" : ""}`}>{item.body}</div>
                          <span className="message-meta">
                            {displayTime(item.time)}
                            {item.direction === "out" && <span className={`message-status ${item.status ?? "queued"}`} title={`Status: ${item.status ?? "queued"}`}><CheckCheck size={13} />{item.status ?? "queued"}</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <form className="composer" onSubmit={previewMode ? (event) => event.preventDefault() : submitMessage}>
                  <div className="composer-box">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={previewMode ? "Demo mode — live messaging is not enabled." : "Write an SMS message..."} rows={2} aria-label="Write a message" maxLength={1600} disabled={previewMode} />
                    <div className="composer-tools">
                      <div>
                        <button type="button" aria-label="Attach file" disabled title="MMS is not configured"><Paperclip size={17} /></button>
                        <button type="button" aria-label="Add emoji" disabled title="Not available yet"><Smile size={17} /></button>
                        <button type="button" aria-label="Insert template" disabled title="Templates are not configured"><FileText size={17} /></button>
                        <button type="button" aria-label="AI assist" disabled title="AI assistance is not configured"><Sparkles size={17} /></button>
                      </div>
                      <span>SMS <ChevronDown size={13} /></span>
                    </div>
                  </div>
                  {sendError && <div className="inline-error send-error" role="alert"><AlertCircle size={15} />{sendError}</div>}
                  <div className="composer-footer"><span>{previewMode ? "Preview only · messages are not sent" : `${draft.length}/1600 characters`}</span><button className="send-button" type="submit" disabled={previewMode || !draft.trim() || isSending}>{isSending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}{isSending ? "Sending" : "Send"}</button></div>
                </form>
              </>
            ) : <div className="select-conversation"><Inbox size={28} /><h2>Select a conversation</h2><p>Choose a thread to view messages.</p></div>}
          </section>

          <aside className="contact-panel">
            <div className="contact-header">
              <div><span className="eyebrow">CONTACT</span><h2>Details</h2></div>
              <button className="icon-button" aria-label="More contact options"><MoreHorizontal size={19} /></button>
            </div>
            {selected && (
              <>
                <div className="contact-identity">
                  <div className="avatar large">{initials(selected.name)}</div>
                  <div><strong>{selected.name}</strong><span>{selected.phone}</span></div>
                </div>
                <div className="contact-status"><span>Status</span><button className={`status-pill status-${selected.status.toLowerCase()}`} disabled>{selected.status}<ChevronDown size={14} /></button></div>
                <div className="contact-owners">
                  <div><span>Owner</span><button className="owner-button"><UserRound size={15} /> Unassigned <ChevronDown size={14} /></button></div>
                  <div><span>Followers</span><button className="add-follower"><Plus size={15} /> Add</button></div>
                </div>
                <div className="tag-heading"><span>Tags <b>0</b></span><button aria-label="Add tag"><Plus size={18} /></button></div>
                <div className="contact-tabs" role="tablist">
                  {["Details", "Activity", "Notes"].map((tab) => <button key={tab} role="tab" aria-selected={contactTab === tab} className={contactTab === tab ? "active" : ""} onClick={() => setContactTab(tab)}>{tab}</button>)}
                </div>
                {contactTab === "Details" ? (
                  <div className="detail-fields">
                    <div className="field-section-title"><UserRound size={15} /> Contact information</div>
                    <div className="detail-field"><span>Phone</span><strong>{selected.phone}</strong></div>
                    <div className="detail-field"><span>First name</span><strong>{selected.name === "New contact" ? "—" : selected.name.split(" ")[0]}</strong></div>
                    <div className="detail-field"><span>Last name</span><strong>—</strong></div>
                    <div className="detail-field"><span>Email</span><strong>—</strong></div>
                    <div className="detail-field"><span>Company</span><strong>—</strong></div>
                    <button className="add-field"><Plus size={15} /> Add a field</button>
                    <div className="field-section-title preferences-title"><ShieldCheck size={15} /> Preferences</div>
                    <div className="detail-field"><span>Do not disturb</span><strong className="dnd-off">Off</strong></div>
                  </div>
                ) : (
                  <div className="tab-placeholder">
                    {contactTab === "Activity" ? <CalendarDays size={22} /> : <FileText size={22} />}
                    <strong>{contactTab === "Activity" ? "No recent activity" : "No notes yet"}</strong>
                    <span>{contactTab === "Activity" ? "Contact activity will appear here." : "Add notes to keep context with this contact."}</span>
                  </div>
                )}
                <div className="contact-footer"><span><Archive size={15} /> Contact created today</span><button aria-label="View contact record"><ChevronRight size={16} /></button></div>
              </>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
