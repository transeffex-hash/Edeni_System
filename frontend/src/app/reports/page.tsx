"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

type ReportType = "sales" | "products" | "customers" | "suppliers" | "expiry" | "profit" | "cashflow";

type SalesRow = { date: string; cash: number; momo: number; credit: number; total: number; count: number };
type ProductRow = { product_id: number; name: string; qty_sold: number; revenue: number; tx_count: number };
type BalanceRow = { name: string; balance: number };
type ExpiryRow = { batch_id: number; product_name: string; quantity: number; expiry_date: string; days_left: number; urgency: string };
type ProfitRow = { product_id: number; name: string; revenue: number; cogs: number; profit: number; qty_sold: number };
type CashRow = { date: string; cash_sales: number; momo_sales: number; credit_sales: number; payments_received: number; net: number };

type ReportData = SalesRow[] | ProductRow[] | BalanceRow[] | ExpiryRow[] | ProfitRow[] | CashRow[] | null;

// ── Helper: Export CSV ────────────────────────────────────────────────

function exportCSV(rows: object[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r: any) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Urgency badge ─────────────────────────────────────────────────────

const urgencyColors: Record<string, string> = {
  expired: "bg-red-600 text-white",
  critical: "bg-orange-500 text-white",
  warning: "bg-yellow-400 text-gray-900",
  ok: "bg-green-100 text-green-800",
};

// ── Report type config ─────────────────────────────────────────────────

const REPORT_TYPES: ReportType[] = ["sales", "products", "customers", "suppliers", "expiry", "profit", "cashflow"];
const DATE_RANGE_TYPES: ReportType[] = ["sales", "products", "profit", "cashflow"];

// ── Main component ─────────────────────────────────────────────────────

export default function ReportsPage() {
  const t = useTranslations();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [reportType, setReportType] = useState<ReportType>("sales");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<ReportData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReport() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      let url = `/api/reports/${reportType}`;
      if (DATE_RANGE_TYPES.includes(reportType)) {
        url += `?start_date=${encodeURIComponent(startDate + "T00:00:00Z")}&end_date=${encodeURIComponent(endDate + "T23:59:59Z")}`;
      }
      const result = await apiGet<any>(url);
      // sales/cashflow return { rows, total, count } — unwrap rows
      setData(result?.rows ?? result);
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleExcelExport() {
    if (!data || !Array.isArray(data) || !data.length) return;
    const filename = `${reportType}-report-${today}.csv`;
    exportCSV(data as object[], filename);
  }

  return (
    <div className="space-y-4">
      {/* Print-only title */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">{t(`reports.types.${reportType}`)}</h2>
        <p className="text-sm text-gray-500">{t("reports.generatedOn")} {new Date().toLocaleString()}</p>
      </div>

      {/* Controls (hidden when printing) */}
      <div className="print:hidden space-y-4">
        <h1 className="text-xl font-semibold">{t("reports.title")}</h1>

        <div className="border rounded p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Report type */}
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("reports.type")}</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={reportType}
                onChange={(e) => { setReportType(e.target.value as ReportType); setData(null); }}
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r} value={r}>{t(`reports.types.${r}`)}</option>
                ))}
              </select>
            </div>

            {/* Date range (only for applicable types) */}
            {DATE_RANGE_TYPES.includes(reportType) && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("analytics.start")}</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("analytics.end")}</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex items-end">
              <button
                className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-50"
                onClick={runReport}
                disabled={loading}
                type="button"
              >
                {loading ? t("reports.generating") : t("reports.generate")}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        {data && Array.isArray(data) && (
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50"
              onClick={handlePrint}
              type="button"
            >
              🖨 {t("reports.print")}
            </button>
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50"
              onClick={handleExcelExport}
              type="button"
            >
              📊 {t("reports.exportExcel")}
            </button>
          </div>
        )}
      </div>

      {/* Report table */}
      {data && Array.isArray(data) && (
        <div className="border rounded overflow-x-auto">
          {reportType === "sales" && <SalesTable rows={data as SalesRow[]} t={t} />}
          {reportType === "products" && <ProductsTable rows={data as ProductRow[]} t={t} />}
          {reportType === "customers" && <BalanceTable rows={data as BalanceRow[]} t={t} type="customer" />}
          {reportType === "suppliers" && <BalanceTable rows={data as BalanceRow[]} t={t} type="supplier" />}
          {reportType === "expiry" && <ExpiryTable rows={data as ExpiryRow[]} t={t} />}
          {reportType === "profit" && <ProfitTable rows={data as ProfitRow[]} t={t} />}
          {reportType === "cashflow" && <CashflowTable rows={data as CashRow[]} t={t} />}
        </div>
      )}

      {data && Array.isArray(data) && data.length === 0 && (
        <div className="border rounded p-6 text-center text-sm text-gray-500">{t("reports.noData")}</div>
      )}
    </div>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-3 text-left font-medium whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 whitespace-nowrap ${className}`}>{children}</td>;
}
function fmt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function SalesTable({ rows, t }: { rows: SalesRow[]; t: any }) {
  const totals = rows.reduce((acc, r) => ({
    cash: acc.cash + r.cash,
    momo: acc.momo + r.momo,
    credit: acc.credit + r.credit,
    total: acc.total + r.total,
    count: acc.count + r.count,
  }), { cash: 0, momo: 0, credit: 0, total: 0, count: 0 });

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{t("reports.col.date")}</Th>
          <Th>{t("reports.col.cash")}</Th>
          <Th>{t("reports.col.momo")}</Th>
          <Th>{t("reports.col.credit")}</Th>
          <Th>{t("reports.col.total")}</Th>
          <Th>{t("reports.col.count")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.date} className="hover:bg-gray-50">
            <Td>{r.date}</Td>
            <Td>{fmt(r.cash)}</Td>
            <Td>{fmt(r.momo)}</Td>
            <Td>{fmt(r.credit)}</Td>
            <Td className="font-medium">{fmt(r.total)}</Td>
            <Td>{r.count}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t bg-gray-50 font-semibold">
        <tr>
          <Td>{t("reports.col.total")}</Td>
          <Td>{fmt(totals.cash)}</Td>
          <Td>{fmt(totals.momo)}</Td>
          <Td>{fmt(totals.credit)}</Td>
          <Td>{fmt(totals.total)}</Td>
          <Td>{totals.count}</Td>
        </tr>
      </tfoot>
    </table>
  );
}

function ProductsTable({ rows, t }: { rows: ProductRow[]; t: any }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.qtySold")}</Th>
          <Th>{t("reports.col.revenue")}</Th>
          <Th>{t("reports.col.transactions")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.product_id} className="hover:bg-gray-50">
            <Td className="font-medium">{r.name}</Td>
            <Td>{r.qty_sold.toLocaleString()}</Td>
            <Td>{fmt(r.revenue)}</Td>
            <Td>{r.tx_count}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BalanceTable({ rows, t, type }: { rows: BalanceRow[]; t: any; type: string }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{type === "customer" ? t("ledger.customer") : t("ledger.supplier")}</Th>
          <Th>{t("reports.col.balance")}</Th>
          <Th>{t("reports.col.status")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50">
            <Td className="font-medium">{r.name}</Td>
            <Td className={r.balance > 0 ? "text-red-600" : "text-green-600"}>{fmt(r.balance)}</Td>
            <Td>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.balance > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {r.balance > 0 ? t("reports.col.owes") : t("reports.col.settled")}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpiryTable({ rows, t }: { rows: ExpiryRow[]; t: any }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.quantity")}</Th>
          <Th>{t("reports.col.expiryDate")}</Th>
          <Th>{t("reports.col.daysLeft")}</Th>
          <Th>{t("reports.col.urgency")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.batch_id} className="hover:bg-gray-50">
            <Td className="font-medium">{r.product_name}</Td>
            <Td>{r.quantity.toLocaleString()}</Td>
            <Td>{r.expiry_date}</Td>
            <Td>{r.days_left < 0 ? t("reports.col.expired") : r.days_left}</Td>
            <Td>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyColors[r.urgency]}`}>
                {t(`reports.urgency.${r.urgency}`)}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfitTable({ rows, t }: { rows: ProfitRow[]; t: any }) {
  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    cogs: acc.cogs + r.cogs,
    profit: acc.profit + r.profit,
  }), { revenue: 0, cogs: 0, profit: 0 });

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.qtySold")}</Th>
          <Th>{t("reports.col.revenue")}</Th>
          <Th>{t("reports.col.cogs")}</Th>
          <Th>{t("reports.col.profit")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.product_id} className="hover:bg-gray-50">
            <Td className="font-medium">{r.name}</Td>
            <Td>{r.qty_sold.toLocaleString()}</Td>
            <Td>{fmt(r.revenue)}</Td>
            <Td>{fmt(r.cogs)}</Td>
            <Td className={r.profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{fmt(r.profit)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t bg-gray-50 font-semibold">
        <tr>
          <Td colSpan={2}>{t("reports.col.total")}</Td>
          <Td>{fmt(totals.revenue)}</Td>
          <Td>{fmt(totals.cogs)}</Td>
          <Td className={totals.profit >= 0 ? "text-green-600" : "text-red-600"}>{fmt(totals.profit)}</Td>
        </tr>
      </tfoot>
    </table>
  );
}

function CashflowTable({ rows, t }: { rows: CashRow[]; t: any }) {
  const totals = rows.reduce((acc, r) => ({
    cash_sales: acc.cash_sales + r.cash_sales,
    momo_sales: acc.momo_sales + r.momo_sales,
    credit_sales: acc.credit_sales + r.credit_sales,
    payments_received: acc.payments_received + r.payments_received,
    net: acc.net + r.net,
  }), { cash_sales: 0, momo_sales: 0, credit_sales: 0, payments_received: 0, net: 0 });

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <Th>{t("reports.col.date")}</Th>
          <Th>{t("reports.col.cash")}</Th>
          <Th>{t("reports.col.momo")}</Th>
          <Th>{t("reports.col.creditSales")}</Th>
          <Th>{t("reports.col.paymentsReceived")}</Th>
          <Th>{t("reports.col.netCash")}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.date} className="hover:bg-gray-50">
            <Td>{r.date}</Td>
            <Td>{fmt(r.cash_sales)}</Td>
            <Td>{fmt(r.momo_sales)}</Td>
            <Td>{fmt(r.credit_sales)}</Td>
            <Td>{fmt(r.payments_received)}</Td>
            <Td className="font-medium text-green-700">{fmt(r.net)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t bg-gray-50 font-semibold">
        <tr>
          <Td>{t("reports.col.total")}</Td>
          <Td>{fmt(totals.cash_sales)}</Td>
          <Td>{fmt(totals.momo_sales)}</Td>
          <Td>{fmt(totals.credit_sales)}</Td>
          <Td>{fmt(totals.payments_received)}</Td>
          <Td className="text-green-700">{fmt(totals.net)}</Td>
        </tr>
      </tfoot>
    </table>
  );
}
