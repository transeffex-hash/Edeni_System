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
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [tin, setTin] = useState("");
  const [momoCode, setMomoCode] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (me?.email) setEmail(me.email);
    if (me?.business_name) setBusinessName(me.business_name);
    setPhone(me?.business_phone || "");
    setTin(me?.business_tin || "");
    setMomoCode(me?.business_momo_code || "");
    setLogoUrl(
      me?.business_logo_url
        ? me.business_logo_url.startsWith("http")
          ? me.business_logo_url
          : `${API_BASE}${me.business_logo_url}`
        : null
    );
  }, [me]);

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

  async function saveBusiness() {
    setError(null);
    setSuccess(null);

    const payload: any = {};
    if (businessName.trim()) payload.business_name = businessName.trim();
    if (phone.trim()) payload.phone = phone.trim();
    payload.tin = tin.trim();
    payload.momo_code = momoCode.trim();

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/business`, {
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
      setSuccess(t("settings.saved"));
    } catch (e: any) {
      setError(e?.message ?? t("settings.failedToSave"));
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/users/logo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("settings.failedToUploadLogo"));
      }
      const data = await res.json();
      setLogoUrl(
        data.logo_url.startsWith("http") ? data.logo_url : `${API_BASE}${data.logo_url}`
      );
      setSuccess(t("settings.logoUploaded"));
      await refreshMe();
    } catch (e: any) {
      setError(e?.message ?? t("settings.failedToUploadLogo"));
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

      <div className="app-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.businessTitle")}</h2>

        <div className="space-y-1.5">
          <label className="app-label">{t("auth.businessName")}</label>
          <input
            className="app-input"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder={t("auth.businessNamePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("auth.phone")}</label>
          <input
            className="app-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("auth.phonePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("settings.tin")}</label>
          <input
            className="app-input"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            placeholder={t("settings.tinPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("settings.momoCode")}</label>
          <input
            className="app-input"
            value={momoCode}
            onChange={(e) => setMomoCode(e.target.value)}
            placeholder={t("settings.momoCodePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="app-label">{t("settings.logo")}</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
            className="app-input"
          />
          {logoUrl && (
            <img
              src={logoUrl}
              alt="logo"
              className="h-16 object-contain mt-2"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button
          className="app-btn-primary"
          onClick={saveBusiness}
          disabled={loading}
          type="button"
        >
          {loading ? t("settings.saving") : t("settings.save")}
        </button>
      </div>
    </div>
  );
}
