"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "use-intl";

import { useAuthStore } from "@/lib/authStore";
import { API_BASE } from "@/lib/api";
import OfflineSync from "@/components/OfflineSync";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const logout = useAuthStore((s) => s.logout);
  const [ready, setReady] = useState(false);
  const locale = useLocale();

  async function handleLogout() {
    await logout(`/${locale}/login`);
  }

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    setReady(true);
  }, []);

  const navItems = [
    { href: "dashboard", label: t("nav.dashboard") },
    { href: "products", label: t("nav.products") },
    { href: "sell", label: t("nav.sell") },
    { href: "ledger", label: t("nav.ledger") },
    { href: "analytics", label: t("nav.analytics") },
    { href: "reports", label: t("nav.reports") },
    { href: "settings", label: t("nav.settings") },
  ];

  if (me?.role === "boss" && ready) {
    navItems.push({ href: "branches", label: t("nav.branches") });
    navItems.push({ href: "team", label: t("nav.team") });
  }

  function isActive(href: string) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    return segments[1] === href;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link className="flex items-center gap-2.5" href={`/${locale}/dashboard`}>
            {me?.business_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={me.business_logo_url.startsWith("http") ? me.business_logo_url : `${API_BASE}${me.business_logo_url}`}
                alt={me.business_name ?? "Logo"}
                width={36}
                height={36}
                className="rounded-lg object-contain bg-white border border-black/5"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#0a7e6b] flex items-center justify-center text-white font-display font-bold text-sm">
                {me?.business_name?.[0]?.toUpperCase() ?? "E"}
              </div>
            )}
            <div className="leading-tight">
              <div className="font-display font-semibold text-[#0e1217] text-sm">
                {me?.business_name || t("app.name")}
              </div>
              <div className="text-[11px] text-gray-500">{t("app.name")}</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-gray-600">{me ? me.email : ""}</div>
            <LocaleSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>

        <nav className="max-w-5xl mx-auto px-4 pb-3 flex gap-1.5 text-sm flex-wrap">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`app-nav-link ${isActive(item.href) ? "app-nav-link-active" : ""}`}
              href={`/${locale}/${item.href}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">{children}</main>
      <OfflineSync />
    </div>
  );
}
