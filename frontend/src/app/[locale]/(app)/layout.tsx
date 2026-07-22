"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "use-intl";

import { useAuthStore } from "@/lib/authStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-3xl mx-auto p-4 flex items-center justify-between">
          <Link className="font-semibold" href="dashboard">
            {t("app.name")}
          </Link>
          <div className="text-sm text-gray-600">{me ? me.email : ""}</div>
        </div>

        <nav className="max-w-3xl mx-auto px-4 pb-3 flex gap-3 text-sm">
          <Link className="px-3 py-1 rounded border" href="dashboard">
            {t("nav.dashboard")}
          </Link>
          <Link className="px-3 py-1 rounded border" href="products">
            {t("nav.products")}
          </Link>
          <Link className="px-3 py-1 rounded border" href="sell">
            {t("nav.sell")}
          </Link>
          <Link className="px-3 py-1 rounded border" href="ledger">
            {t("nav.ledger")}
          </Link>
          <Link className="px-3 py-1 rounded border" href="analytics">
            {t("nav.analytics")}
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  );
}
