"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

type Branch = { id: number; business_id: number; name: string; is_active: boolean };

export default function BranchesPage() {
  const t = useTranslations();
  const me = useAuthStore((s) => s.me);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Branch[]>("/api/branches");
        setBranches(data);
      } catch {
        setError(t("branches.failedToLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function createBranch() {
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError(`${t("branches.name")} ${t("errors.required")}`);
      return;
    }
    setSaving(true);
    try {
      const branch = await apiPost<Branch>("/api/branches", { name: name.trim() });
      setBranches((prev) => [...prev, branch]);
      setName("");
      setSuccess(t("branches.created"));
    } catch (e: any) {
      setError(e?.message ?? t("branches.failedToCreate"));
    } finally {
      setSaving(false);
    }
  }

  const isSuperBoss = me?.role === "boss" && me?.branch_id === null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">{t("branches.title")}</h1>
        <p className="app-page-subtitle">{t("branches.hint")}</p>
      </div>

      {isSuperBoss && (
        <div className="app-card p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="app-label">{t("branches.name")}</label>
            <input
              className="app-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("branches.namePlaceholder")}
            />
          </div>
          <button
            className="app-btn-primary"
            onClick={createBranch}
            disabled={saving}
            type="button"
          >
            {saving ? t("branches.saving") : t("branches.create")}
          </button>
        </div>
      )}

      {!isSuperBoss && me?.role === "boss" && (
        <p className="text-sm text-gray-500 italic">{t("branches.superBossOnly")}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-gray-500">{t("branches.noBranches")}</p>
      ) : (
        <div className="app-card overflow-hidden">
          {branches.map((b) => (
            <div key={b.id} className="app-list-row">
              <div>
                <div className="font-medium text-gray-800">{b.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className={`app-badge ${b.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                    {b.is_active ? t("branches.active") : t("branches.inactive")}
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-400">#{b.id}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </div>
  );
}
