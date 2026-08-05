"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";

import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
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
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);

      const res = await fetch(API_BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        credentials: "include"
      });

      if (!res.ok) {
        throw new Error(t("errors.invalidCredentials"));
      }

      await res.json();
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Left side - Image (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 relative overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src="/business owner looking into his phone tracking performancepng.png"
            alt="Business owner tracking performance"
            fill
            sizes="50vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-blue-600/30"></div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 p-6 md:p-12 flex flex-col justify-center">
        <div className="max-w-md w-full mx-auto glass-panel rounded-3xl p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-[#0a7e6b] font-semibold mb-3">
              EdeniSystem
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-gray-900 mb-2">
              {t("auth.login")}
            </h1>
            <p className="text-gray-600">
              {t("landing.features.ledger.title")} • {t("auth.email")}
            </p>
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.email")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.password")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t("auth.passwordPlaceholder")}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              className="w-full px-4 py-3 rounded-full bg-[#0a7e6b] hover:bg-[#096657] text-white font-semibold disabled:opacity-50 transition-colors"
              disabled={loading}
              type="submit"
            >
              {loading ? t("auth.loggingIn") : t("auth.login")}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {t("auth.noAccount")}
                </span>
              </div>
            </div>

            <Link href={`/${locale}/register`}>
              <button
                type="button"
                className="w-full px-4 py-3 rounded-full border-2 border-[#0a7e6b] text-[#0a7e6b] hover:bg-[#0a7e6b]/10 font-semibold transition-colors"
              >
                {t("auth.registerCta")}
              </button>
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
