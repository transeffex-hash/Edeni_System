"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";

import { apiPost } from "@/lib/api";

type RegisterPayload = {
  business_name: string;
  owner_email: string;
  password: string;
  phone: string;
};

export default function RegisterPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError(`${t("auth.businessName")} ${t("errors.required")}`);
      return;
    }
    if (!ownerEmail.trim()) {
      setError(`${t("auth.ownerEmail")} ${t("errors.required")}`);
      return;
    }
    if (!phone.trim()) {
      setError(`${t("auth.phone")} ${t("errors.required")}`);
      return;
    }
    if (!password) {
      setError(`${t("auth.password")} ${t("errors.required")}`);
      return;
    }
    if (!confirmPassword) {
      setError(`${t("auth.confirmPassword")} ${t("errors.required")}`);
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }

    setLoading(true);

    try {
      const payload: Registd = {
        business_name: businessName.trim(),
        owner_email: ownerEmail.trim(),
        password,
        phone: phone.trim() || null
      };

      await apiPost("/api/auth/register", payload);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message?: string }).message || t("errors.registerFailed")));
      } else {
        setError(t("errors.registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Left side - Image (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-600 relative overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src="/a woman in a car and seeing how her business is performing on her phone.png"
            alt="Wholesaler managing stock"
            fill
            sizes="50vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-green-600/30"></div>
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
              {t("auth.register")}
            </h1>
            <p className="text-gray-600">
              {t("auth.registerSubtitle")}
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.businessName")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition-colors"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t("auth.businessNamePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.ownerEmail")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition-colors"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.phoneOptional")}
              </label>
              <input
                className="w-full border-2 border-gray-3
                required00 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition-colors"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.password")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t("auth.passwordPlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t("auth.confirmPassword")}
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition-colors"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? t("auth.creatingAccount") : t("auth.registerCta")}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {t("auth.haveAccount")}
                </span>
              </div>
            </div>

            <Link href={`/${locale}/login`}>
              <button
                type="button"
                className="w-full px-4 py-3 rounded-full border-2 border-[#0a7e6b] text-[#0a7e6b] hover:bg-[#0a7e6b]/10 font-semibold transition-colors"
              >
                {t("auth.login")}
              </button>
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
