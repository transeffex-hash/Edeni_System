"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { API_BASE } from "@/lib/api";

export default function AdminLoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("email", email);
      params.set("password", password);

      const res = await fetch(API_BASE + `/api/admin/login?${params.toString()}`, {
        method: "POST",
        credentials: "include"
      });

      if (!res.ok) throw new Error(t("admin.invalidCredentials"));

      router.push("/admin/businesses");
    } catch (e: any) {
      setError(e?.message ?? t("admin.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0a7e6b] text-white font-display font-bold text-xl mb-3">
            E
          </div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">{t("admin.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">EdeniSystem</p>
        </div>

        <form className="app-card p-6 md:p-8 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="app-label">{t("admin.email")}</label>
            <input
              className="app-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="app-label">{t("admin.password")}</label>
            <input
              className="app-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            className="app-btn-primary w-full"
            disabled={loading}
            type="submit"
          >
            {loading ? t("admin.signingIn") : t("admin.signIn")}
          </button>
        </form>
      </div>
    </main>
  );
}
