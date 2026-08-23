"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

type SalesRow = { date: string; cash: number; momo: number; credit: number; total: number; count: number };
type ProductRow = { product_id: number; name: string; qty_sold: number; revenue: number; tx_count: number };
type ProfitRow = { product_id: number; name: string; revenue: number; cogs: number; profit: number; qty_sold: number };
type CashRow = { date: string; cash_sales: number; momo_sales: number; credit_sales: number; payments_received: number; net: number };
type BalanceRow = { name: string; balance: number };

function money(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} RWF`;
}

function barWidth(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export default function AnalyticsPage() {
  const t = useTranslations();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ start: monthStart, end: today });
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [profits, setProfits] = useState<ProfitRow[]>([]);
  const [cashflow, setCashflow] = useState<CashRow[]>([]);
  const [customers, setCustomers] = useState<BalanceRow[]>([]);
  const [suppliers, setSuppliers] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics(start = appliedRange.start, end = appliedRange.end) {
    setLoading(true);
    setError(null);
    const qs = `start_date=${encodeURIComponent(`${start}T00:00:00Z`)}&end_date=${encodeURIComponent(`${end}T23:59:59Z`)}`;
    try {
      const [salesData, productsData, profitData, cashData, customerData, supplierData] = await Promise.all([
        apiGet<{ rows: SalesRow[] }>(`/api/reports/sales?${qs}`),
        apiGet<ProductRow[]>(`/api/reports/products?${qs}`),
        apiGet<ProfitRow[]>(`/api/reports/profit?${qs}`),
        apiGet<CashRow[]>(`/api/reports/cashflow?${qs}`),
        apiGet<BalanceRow[]>(`/api/reports/customers?${qs}`),
        apiGet<BalanceRow[]>(`/api/reports/suppliers?${qs}`),
      ]);
      setSales(salesData.rows ?? []);
      setProducts(productsData ?? []);
      setProfits(profitData ?? []);
      setCashflow(cashData ?? []);
      setCustomers(customerData ?? []);
      setSuppliers(supplierData ?? []);
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(monthStart, today);
  }, [monthStart, today]);

  function applyRange() {
    setAppliedRange({ start: startDate, end: endDate });
    loadAnalytics(startDate, endDate);
  }

  function onPrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  const totalSales = sales.reduce((sum, row) => sum + row.total, 0);
  const totalProfit = profits.reduce((sum, row) => sum + row.profit, 0);
  const totalCash = cashflow.reduce((sum, row) => sum + row.net, 0);
  const totalCustomerDebt = customers.reduce((sum, row) => sum + Math.max(row.balance, 0), 0);
  const grossMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
  const maxSales = Math.max(...sales.map((row) => row.total), 0);
  const maxProductRevenue = Math.max(...products.slice(0, 5).map((row) => row.revenue), 0);
  const maxProfit = Math.max(...profits.slice(0, 5).map((row) => Math.max(row.profit, 0)), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="app-page-title">{t("analytics.title")}</h1>
          <p className="app-page-subtitle">{t("analytics.subtitle")}</p>
        </div>
        <button className="app-btn-ghost print:hidden" onClick={onPrint} type="button">
          {t("analytics.print")}
        </button>
      </div>

      <div className="app-card p-5 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("analytics.start")}</label>
            <input className="app-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="app-label">{t("analytics.end")}</label>
            <input className="app-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="app-btn-primary w-full disabled:opacity-50" onClick={applyRange} disabled={loading} type="button">
              {loading ? t("analytics.loading") : t("analytics.apply")}
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500">{t("analytics.selected", { start: appliedRange.start, end: appliedRange.end })}</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t("analytics.metrics.sales")} value={money(totalSales)} tone="green" />
        <MetricCard label={t("analytics.metrics.profit")} value={money(totalProfit)} tone={totalProfit >= 0 ? "green" : "red"} />
        <MetricCard label={t("analytics.metrics.cashIn")} value={money(totalCash)} tone="blue" />
        <MetricCard label={t("analytics.metrics.customerDebt")} value={money(totalCustomerDebt)} tone="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="app-card p-5 space-y-4">
          <SectionTitle title={t("analytics.salesTrend")} hint={t("analytics.salesTrendHint")} />
          <div className="space-y-3">
            {sales.map((row) => (
              <div key={row.date}>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{row.date}</span><span>{money(row.total)}</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#0a7e6b] rounded-full" style={{ width: barWidth(row.total, maxSales) }} /></div>
              </div>
            ))}
            {!sales.length && <Empty text={t("analytics.noData")} />}
          </div>
        </div>

        <div className="app-card p-5 space-y-4">
          <SectionTitle title={t("analytics.cashMix")} hint={t("analytics.cashMixHint")} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniMetric label={t("reports.col.cash")} value={money(sales.reduce((s, r) => s + r.cash, 0))} />
            <MiniMetric label={t("reports.col.momo")} value={money(sales.reduce((s, r) => s + r.momo, 0))} />
            <MiniMetric label={t("reports.col.credit")} value={money(sales.reduce((s, r) => s + r.credit, 0))} />
          </div>
          <div className="rounded-xl bg-[#f6f7f8] p-4 text-sm text-gray-600">
            {t("analytics.marginInsight", { margin: grossMargin.toFixed(1) })}
          </div>
        </div>

        <RankedBars title={t("analytics.bestProducts")} hint={t("analytics.bestProductsHint")} rows={products.slice(0, 5).map((p) => ({ key: p.product_id, name: p.name, value: p.revenue }))} max={maxProductRevenue} />
        <RankedBars title={t("analytics.profitLeaders")} hint={t("analytics.profitLeadersHint")} rows={profits.slice(0, 5).map((p) => ({ key: p.product_id, name: p.name, value: p.profit }))} max={maxProfit} />
      </div>

      <div className="app-card p-5 space-y-4">
        <SectionTitle title={t("analytics.debtRisk")} hint={t("analytics.debtRiskHint")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DebtList title={t("reports.types.customers")} rows={customers.slice(0, 5)} />
          <DebtList title={t("reports.types.suppliers")} rows={suppliers.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" | "orange" }) {
  const color = tone === "green" ? "text-[#0a7e6b]" : tone === "red" ? "text-red-600" : tone === "blue" ? "text-blue-600" : "text-orange-600";
  return <div className="app-card p-5"><div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div><div className={`mt-2 text-xl font-bold ${color}`}>{value}</div></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-black/5 p-3"><div className="text-xs text-gray-500">{label}</div><div className="font-semibold text-gray-900 mt-1">{value}</div></div>;
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return <div><h2 className="font-semibold text-gray-900">{title}</h2><p className="text-xs text-gray-500 mt-0.5">{hint}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl bg-[#f6f7f8] p-4 text-sm text-gray-500 text-center">{text}</div>;
}

function RankedBars({ title, hint, rows, max }: { title: string; hint: string; rows: { key: number; name: string; value: number }[]; max: number }) {
  return <div className="app-card p-5 space-y-4"><SectionTitle title={title} hint={hint} /><div className="space-y-3">{rows.map((row) => <div key={row.key}><div className="flex justify-between text-xs text-gray-500 mb-1"><span className="font-medium text-gray-700">{row.name}</span><span>{money(row.value)}</span></div><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#0a7e6b] rounded-full" style={{ width: barWidth(Math.max(row.value, 0), max) }} /></div></div>)}{!rows.length && <Empty text="No data" />}</div></div>;
}

function DebtList({ title, rows }: { title: string; rows: BalanceRow[] }) {
  return <div className="rounded-xl border border-black/5 overflow-hidden"><div className="bg-[#f6f7f8] px-4 py-3 font-semibold text-sm text-gray-800">{title}</div>{rows.map((row, index) => <div key={`${row.name}-${index}`} className="px-4 py-3 flex justify-between text-sm border-t border-black/5"><span className="text-gray-700">{row.name || "—"}</span><span className={row.balance > 0 ? "font-semibold text-red-600" : "font-semibold text-green-700"}>{money(row.balance)}</span></div>)}{!rows.length && <div className="px-4 py-4 text-sm text-gray-500">No data</div>}</div>;
}
