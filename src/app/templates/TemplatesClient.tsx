"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";
import type { WhatsAppTemplate } from "@/types/models";

export default function TemplatesClient() {
  const { data: session } = useSession();
  const { data, mutate, isLoading } = useSWR<{ templates: WhatsAppTemplate[] }>(
    "/api/whatsapp-templates",
    fetcher
  );
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const templates = data?.templates || [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/api/whatsapp-templates", "POST", { name: name.trim(), body: body.trim() });
      setName("");
      setBody("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    setError(null);
    try {
      await apiRequest(`/api/whatsapp-templates/${id}`, "DELETE");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">WhatsApp Templates</h1>
      <p className="mb-5 text-sm text-slate-500">
        Shared with the whole team. Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{name}}"}</code>{" "}
        in the message and it&apos;ll be swapped for the lead&apos;s contact name (or lead name) when sent.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name, e.g. First follow-up"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Hi {{name}}, following up on our call..."}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !name.trim() || !body.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save template"}
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && templates.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No templates yet — add your first one above.
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => {
          const canDelete = session?.user.role === "ADMIN" || t.createdBy?.id === session?.user.id;
          return (
            <div key={t.id} className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{t.body}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {t.createdBy?.name || "Unknown"} · {relativeTime(t.createdAt)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(t.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
