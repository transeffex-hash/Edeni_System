"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { API_BASE } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

export default function SettingsPage() {
  const t = useTranslations();
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (me?.email) setEmail(me.email);
  }, [me?.email]);

  async function saveProfile() {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError(`${t("auth.email")} ${t("errors.required")}`);
      return;
    }
    if (password && password !== confirm) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }

    const payload: any = { email: email.trim() };
    if (password) payload.password = password;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("settings.failedToSave"));
      }
      await refreshMe();
      setPassword("");
      setConfirm("");
      setSuccess(t("settings.saved"));
    } catch (e: any) {
      setError(e?.message ?? t("settings.failedToSave"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">{t("settings.title")}</h1>
        <p className="app-page-subtitle">{t("settings.hint")}</p>
      </div>

      <div className="app-card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="app-label">{t("auth.email")}</label>
          <input
            className="app-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("auth.password")}</label>
          <input
            className="app-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("settings.passwordPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("auth.confirmPassword")}</label>
          <input
            className="app-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("settings.passwordPlaceholder")}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button
          className="app-btn-primary"
          onClick={saveProfile}
          disabled={loading}
          type="button"
        >
          {loading ? t("settings.saving") : t("settings.save")}
        </button>
      </div>
    </div>
  );
}
