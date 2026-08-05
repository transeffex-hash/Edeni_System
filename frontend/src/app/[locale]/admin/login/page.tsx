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
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">{t("admin.title")}</h1>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">{t("admin.email")}</label>
          <input className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm">{t("admin.password")}</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={loading}>
          {loading ? t("admin.signingIn") : t("admin.signIn")}
        </button>
      </form>
    </main>
  );
}
