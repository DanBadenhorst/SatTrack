"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Send, Bell, BellOff } from "lucide-react";
import type { GroupMessage } from "@/lib/types";

interface GroupOption {
  id: string;
  name: string;
}

interface Props {
  groups: GroupOption[];
  userId: string;
  userEmail: string;
}

const nameFromEmail = (email: string) => email.split("@")[0];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GroupFeed({ groups, userId, userEmail }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notify, setNotify] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(
    async (groupId: string, showSpinner = false) => {
      if (!groupId) return;
      if (showSpinner) setLoading(true);
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as GroupMessage[]) ?? []);
      if (showSpinner) setLoading(false);
    },
    [supabase]
  );

  const loadNotify = useCallback(
    async (groupId: string) => {
      if (!groupId) return;
      const { data } = await supabase
        .from("group_feed_subscriptions")
        .select("active")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
      setNotify(data?.active ?? false);
    },
    [supabase, userId]
  );

  // Load + poll messages for the selected group.
  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId, true);
    loadNotify(selectedId);
    const interval = setInterval(() => loadMessages(selectedId), 15000);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages, loadNotify]);

  // Keep the feed scrolled to the latest message.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedId) return;
    setPosting(true);
    setError(null);
    const res = await fetch("/api/groups/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: selectedId, body: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send message.");
      setPosting(false);
      return;
    }
    setDraft("");
    await loadMessages(selectedId);
    setPosting(false);
  }

  async function toggleNotify() {
    if (!selectedId) return;
    setNotifyBusy(true);
    setError(null);
    const next = !notify;
    const { error: err } = await supabase
      .from("group_feed_subscriptions")
      .upsert(
        { group_id: selectedId, user_id: userId, email: userEmail, active: next },
        { onConflict: "group_id,user_id" }
      );
    if (err) {
      setError(err.message);
    } else {
      setNotify(next);
    }
    setNotifyBusy(false);
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 text-center text-slate-500">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Join or create a group to use the message feed.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
      {/* Header: group selector + notification toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-space-400" />
          <h2 className="font-semibold text-white">Group feed</h2>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="ml-2 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-space-500"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={toggleNotify}
          disabled={notifyBusy}
          title={notify ? "Email notifications on" : "Email notifications off"}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
            notify
              ? "bg-space-700/40 border border-space-700 text-space-200"
              : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          {notify ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          Email me on new posts
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              notify ? "bg-space-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notify ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Message list */}
      <div ref={listRef} className="max-h-80 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No messages yet. Start the conversation about the next good pass.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-space-300">
                    {mine ? "You" : nameFromEmail(m.author_email)}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatTime(m.created_at)}</span>
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-space-700/40 border border-space-700 text-slate-100"
                      : "bg-slate-800 border border-slate-700 text-slate-200"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={post} className="flex items-center gap-2 p-4 border-t border-slate-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message your group…"
          maxLength={2000}
          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
        />
        <button
          type="submit"
          disabled={posting || !draft.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
        >
          <Send className="w-4 h-4" />
          {posting ? "Sending…" : "Send"}
        </button>
      </form>

      {error && (
        <div className="px-4 pb-4 -mt-2 text-sm text-red-400">{error}</div>
      )}
    </div>
  );
}
