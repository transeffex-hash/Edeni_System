"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import AutocompleteSearch from "@/components/AutocompleteSearch";
import { useConfirm } from "@/hooks/useConfirm";

type Branch = { id: number; business_id: number; name: string; is_active: boolean };
type UserOut = { id: number; email: string; role: "boss" | "user"; branch_id: number | null; is_active: boolean };

export default function TeamPage() {
  const t = useTranslations();
  const { confirm, Dialog } = useConfirm();
  const me = useAuthStore((s) => s.me);

  const [users, setUsers] = useState<UserOut[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"boss" | "user">("user");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperBoss = me?.role === "boss" && me?.branch_id === null;
  const isBranchBoss = me?.role === "boss" && me?.branch_id !== null;

  useEffect(() => {
    (async () => {
      try {
        const [u, b] = await Promise.all([
          apiGet<UserOut[]>("/api/users/"),
          apiGet<Branch[]>("/api/branches"),
        ]);
        setUsers(u);
        setBranches(b);
        if (isBranchBoss && me?.branch_id) {
          setBranchId(me.branch_id);
        }
      } catch {
        setError(t("team.failedToLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t, isBranchBoss, me?.branch_id]);

  async function createUser() {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError(`${t("team.email")} ${t("errors.required")}`);
      return;
    }
    if (!password.trim()) {
      setError(`${t("team.password")} ${t("errors.required")}`);
      return;
    }
    setSaving(true);
    try {
      const user = await apiPost<UserOut>("/api/users/", {
        email: email.trim(),
        password: password.trim(),
        role,
        branch_id: isBranchBoss ? me?.branch_id : branchId,
      });
      setUsers((prev) => [...prev, user]);
      setEmail("");
      setPassword("");
      setSuccess(t("team.created"));
    } catch (e: any) {
      setError(e?.message ?? t("team.failedToCreate"));
    } finally {
      setSaving(false);
    }
  }

  function branchName(id: number | null): string {
    if (id === null) return t("team.noBranch");
    const b = branches.find((x) => x.id === id);
    return b ? b.name : `#${id}`;
  }

  async function toggleUser(user: UserOut) {
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}?is_active=${!user.is_active}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as UserOut;
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError(t("team.failedToLoad"));
    }
  }

  async function doDeleteUser(user: UserOut) {
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: false } : u)));
    } catch {
      setError(t("team.failedToLoad"));
    }
  }

  function askDeleteUser(user: UserOut) {
    confirm(t("team.deactivateConfirm"), () => doDeleteUser(user));
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">{t("team.title")}</h1>
        <p className="app-page-subtitle">{t("team.hint")}</p>
      </div>

      <div className="app-card p-5 space-y-4">
        <p className="text-xs text-gray-500">{t("team.superBossNote")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("team.email")}</label>
            <input
              className="app-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="app-label">{t("team.password")}</label>
            <input
              className="app-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("team.role")}</label>
            <select
              className="app-input"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              disabled={isBranchBoss}
            >
              <option value="user">{t("team.user")}</option>
              {isSuperBoss && <option value="boss">{t("team.boss")}</option>}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="app-label">{t("team.branch")}</label>
            <AutocompleteSearch
              items={branches.map((b) => ({ value: b.id, label: b.name }))}
              value={branchId}
              onChange={(v) => setBranchId(Number(v))}
              placeholder={t("team.selectBranch")}
              disabled={isBranchBoss}
            />
          </div>
        </div>

        <button
          className="app-btn-primary"
          onClick={createUser}
          disabled={saving}
          type="button"
        >
          {saving ? t("team.saving") : t("team.create")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">{t("team.noUsers")}</p>
      ) : (
        <div className="app-card overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="app-list-row">
              <div>
                <div className="font-medium text-gray-800">{u.email}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {u.role === "boss" ? t("team.boss") : t("team.user")} · {branchName(u.branch_id)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    u.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {u.is_active ? t("team.active") : t("team.inactive")}
                </span>
                {u.id !== me?.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleUser(u)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      type="button"
                    >
                      {u.is_active ? t("team.deactivate") : t("team.activate")}
                    </button>
                    {u.is_active && (
                      <button
                        onClick={() => askDeleteUser(u)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                        type="button"
                      >
                        {t("team.delete")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </div>
    <Dialog />
    </>
  );
}
