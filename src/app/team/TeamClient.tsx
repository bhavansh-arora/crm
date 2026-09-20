"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatDate } from "@/lib/format";
import type { TeamMember } from "@/types/models";

export default function TeamClient() {
  const { data, mutate, isLoading } = useSWR<{ users: TeamMember[] }>("/api/users", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const users = data?.users || [];

  async function toggleActive(user: TeamMember) {
    setError(null);
    try {
      await apiRequest(`/api/users/${user.id}`, "PATCH", { active: !user.active });
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ Add sales rep"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
      )}

      {showForm && (
        <AddUserForm
          onDone={() => {
            setShowForm(false);
            mutate();
          }}
          onError={setError}
        />
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading team…</p>}

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {u.name} {u.role === "ADMIN" && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">Admin</span>}
                {!u.active && <span className="ml-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-500">Inactive</span>}
              </p>
              <p className="truncate text-sm text-slate-500">{u.email}</p>
              <p className="text-xs text-slate-400">
                {u._count?.leads ?? 0} leads assigned · joined {formatDate(u.createdAt)}
              </p>
            </div>
            {u.role === "SALES_REP" && (
              <button
                onClick={() => toggleActive(u)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
                  u.active
                    ? "text-rose-600 ring-rose-200 hover:bg-rose-50"
                    : "text-emerald-600 ring-emerald-200 hover:bg-emerald-50"
                }`}
              >
                {u.active ? "Deactivate" : "Reactivate"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddUserForm({ onDone, onError }: { onDone: () => void; onError: (msg: string | null) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SALES_REP" | "ADMIN">("SALES_REP");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    try {
      await apiRequest("/api/users", "POST", { name, email, password, role });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          required
          type="password"
          placeholder="Temporary password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "SALES_REP" | "ADMIN")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="SALES_REP">Sales rep</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
