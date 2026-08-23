"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

type ReportType = "sales" | "products" | "customers" | "suppliers" | "expiry" | "profit" | "cashflow" | "overdue" | "voided";

type SalesRow = { date: string; cash: number; momo: number; credit: number; total: number; count: number };
type ProductRow = { product_id: number; name: string; qty_sold: number; revenue: number; tx_count: number };
type BalanceRow = { name: string; balance: number };
type ExpiryRow = { batch_id: number; product_name: string; quantity: number; expiry_date: string; days_left: number; urgency: string };
type ProfitRow = { product_id: number; name: string; revenue: number; cogs: number; profit: number; qty_sold: number };
type CashRow = { date: string; cash_sales: number; momo_sales: number; credit_sales: number; payments_received: number; net: number };
type OverdueRow = { sale_id: number; customer_name: string; total_amount: number; due_date: string; days_overdue: number };
type VoidedRow = { sale_id: number; customer_name: string; total_amount: number; payment_method: string; is_credit: boolean; voided_by_email: string | null; voided_at: string | null; void_reason: string | null; created_at: string };

type SoldProductRow = { product_id: number; name: string; qty_sold: number; revenue: number };

type ReportData = SalesRow[] | ProductRow[] | BalanceRow[] | ExpiryRow[] | ProfitRow[] | CashRow[] | OverdueRow[] | VoidedRow[] | null;

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

const REPORT_TYPES: ReportType[] = ["sales", "products", "customers", "suppliers", "expiry", "profit", "cashflow", "overdue", "voided"];
const DATE_RANGE_TYPES: ReportType[] = ["sales", "products", "customers", "suppliers", "expiry", "profit", "cashflow", "overdue", "voided"];

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
  const [generatedAt, setGeneratedAt] = useState("");
  const [soldProducts, setSoldProducts] = useState<SoldProductRow[]>([]);
  const [activeInPeriod, setActiveInPeriod] = useState(false);
  const [includeSettled, setIncludeSettled] = useState(false);

  const isBalanceReport = reportType === "customers" || reportType === "suppliers";

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
  }, []);

  async function runReport() {
    setLoading(true);
    setError(null);
    setData(null);
    setSoldProducts([]);
    try {
      let url = `/api/reports/${reportType}`;
      if (DATE_RANGE_TYPES.includes(reportType)) {
        url += `?start_date=${encodeURIComponent(startDate + "T00:00:00Z")}&end_date=${encodeURIComponent(endDate + "T23:59:59Z")}`;
      }
      if (isBalanceReport) {
        url += `&active_in_period=${activeInPeriod}&include_settled=${includeSettled}`;
      }
      const result = await apiGet<any>(url);
      // sales/cashflow return { rows, total, count } — unwrap rows
      setData(result?.rows ?? result);
      setSoldProducts(Array.isArray(result?.products) ? result.products : []);
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
    <div className="space-y-5">
      {/* Print-only title */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">{t(`reports.types.${reportType}`)}</h2>
        <p className="text-sm text-gray-500">{t("reports.generatedOn")} {generatedAt}</p>
      </div>

      {/* Controls (hidden when printing) */}
      <div className="print:hidden space-y-5">
        <h1 className="app-page-title">{t("reports.title")}</h1>

        <div className="app-card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Report type */}
            <div className="space-y-1.5">
              <label className="app-label">{t("reports.type")}</label>
              <select
                className="app-input"
                value={reportType}
                onChange={(e) => { setReportType(e.target.value as ReportType); setData(null); setSoldProducts([]); }}
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r} value={r}>{t(`reports.types.${r}`)}</option>
                ))}
              </select>
            </div>

            {/* Date range (only for applicable types) */}
            {DATE_RANGE_TYPES.includes(reportType) && (
              <>
                <div className="space-y-1.5">
                  <label className="app-label">{t("analytics.start")}</label>
                  <input
                    type="date"
                    className="app-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="app-label">{t("analytics.end")}</label>
                  <input
                    type="date"
                    className="app-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {isBalanceReport && (
              <div className="col-span-1 sm:col-span-2 md:col-span-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={activeInPeriod}
                    onChange={(e) => setActiveInPeriod(e.target.checked)}
                  />
                  {t("reports.activeInPeriod")}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={includeSettled}
                    onChange={(e) => setIncludeSettled(e.target.checked)}
                  />
                  {t("reports.includeSettled")}
                </label>
              </div>
            )}

            <div className="flex items-end">
              <button
                className="app-btn-primary w-full disabled:opacity-50"
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
              className="app-btn-ghost"
              onClick={handlePrint}
              type="button"
            >
              🖨 {t("reports.print")}
            </button>
            <button
              className="app-btn-ghost"
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
        <div className="app-card overflow-x-auto">
          {reportType === "sales" && <SalesTable rows={data as SalesRow[]} t={t} />}
          {reportType === "products" && <ProductsTable rows={data as ProductRow[]} t={t} />}
          {reportType === "customers" && <BalanceTable rows={data as BalanceRow[]} t={t} type="customer" />}
          {reportType === "suppliers" && <BalanceTable rows={data as BalanceRow[]} t={t} type="supplier" />}
          {reportType === "expiry" && <ExpiryTable rows={data as ExpiryRow[]} t={t} />}
          {reportType === "profit" && <ProfitTable rows={data as ProfitRow[]} t={t} />}
          {reportType === "cashflow" && <CashflowTable rows={data as CashRow[]} t={t} />}
          {reportType === "overdue" && <OverdueTable rows={data as OverdueRow[]} t={t} />}
          {reportType === "voided" && <VoidedTable rows={data as VoidedRow[]} t={t} />}
        </div>
      )}

      {reportType === "sales" && soldProducts.length > 0 && (
        <div className="app-card overflow-x-auto">
          <div className="px-4 pt-4 text-sm font-semibold text-gray-700">{t("reports.productsSold")}</div>
          <SoldProductsTable rows={soldProducts} t={t} />
        </div>
      )}

      {data && Array.isArray(data) && data.length === 0 && (
        <div className="app-card p-8 text-center text-sm text-gray-500">{t("reports.noData")}</div>
      )}
    </div>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap text-left">{children}</th>;
}
function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td className={`whitespace-nowrap ${className}`} colSpan={colSpan}>{children}</td>;
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
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.date")}</Th>
          <Th>{t("reports.col.cash")}</Th>
          <Th>{t("reports.col.momo")}</Th>
          <Th>{t("reports.col.credit")}</Th>
          <Th>{t("reports.col.total")}</Th>
          <Th>{t("reports.col.count")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            <Td>{r.date}</Td>
            <Td>{fmt(r.cash)}</Td>
            <Td>{fmt(r.momo)}</Td>
            <Td>{fmt(r.credit)}</Td>
            <Td className="font-medium">{fmt(r.total)}</Td>
            <Td>{r.count}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
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
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.qtySold")}</Th>
          <Th>{t("reports.col.revenue")}</Th>
          <Th>{t("reports.col.transactions")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.product_id}>
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

function SoldProductsTable({ rows, t }: { rows: SoldProductRow[]; t: any }) {
  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  return (
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.qtySold")}</Th>
          <Th>{t("reports.col.revenue")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.product_id}>
            <Td className="font-medium">{r.name}</Td>
            <Td>{r.qty_sold.toLocaleString()}</Td>
            <Td>{fmt(r.revenue)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <Td colSpan={2}>{t("reports.col.total")}</Td>
          <Td>{fmt(totalRevenue)}</Td>
        </tr>
      </tfoot>
    </table>
  );
}

function BalanceTable({ rows, t, type }: { rows: BalanceRow[]; t: any; type: string }) {
  return (
    <table className="app-table">
      <thead>
        <tr>
          <Th>{type === "customer" ? t("ledger.customer") : t("ledger.supplier")}</Th>
          <Th>{t("reports.col.balance")}</Th>
          <Th>{t("reports.col.status")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <Td className="font-medium">{r.name}</Td>
            <Td className={r.balance > 0 ? "text-red-600" : "text-green-600"}>{fmt(r.balance)}</Td>
            <Td>
              <span className={`app-badge ${r.balance > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
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
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.quantity")}</Th>
          <Th>{t("reports.col.expiryDate")}</Th>
          <Th>{t("reports.col.daysLeft")}</Th>
          <Th>{t("reports.col.urgency")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.batch_id}>
            <Td className="font-medium">{r.product_name}</Td>
            <Td>{r.quantity.toLocaleString()}</Td>
            <Td>{r.expiry_date}</Td>
            <Td>{r.days_left < 0 ? t("reports.col.expired") : r.days_left}</Td>
            <Td>
              <span className={`app-badge ${urgencyColors[r.urgency]}`}>
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
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.product")}</Th>
          <Th>{t("reports.col.qtySold")}</Th>
          <Th>{t("reports.col.revenue")}</Th>
          <Th>{t("reports.col.cogs")}</Th>
          <Th>{t("reports.col.profit")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.product_id}>
            <Td className="font-medium">{r.name}</Td>
            <Td>{r.qty_sold.toLocaleString()}</Td>
            <Td>{fmt(r.revenue)}</Td>
            <Td>{fmt(r.cogs)}</Td>
            <Td className={r.profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{fmt(r.profit)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
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

function OverdueTable({ rows, t }: { rows: OverdueRow[]; t: any }) {
  return (
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.saleId")}</Th>
          <Th>{t("reports.col.customer")}</Th>
          <Th>{t("reports.col.total")}</Th>
          <Th>{t("reports.col.dueDate")}</Th>
          <Th>{t("reports.col.daysOverdue")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.sale_id}>
            <Td className="font-medium">#{r.sale_id}</Td>
            <Td>{r.customer_name || "—"}</Td>
            <Td>{fmt(r.total_amount)}</Td>
            <Td>{r.due_date}</Td>
            <Td className="text-red-600 font-medium">{r.days_overdue}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VoidedTable({ rows, t }: { rows: VoidedRow[]; t: any }) {
  const totalAmount = rows.reduce((acc, r) => acc + r.total_amount, 0);
  return (
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.saleId")}</Th>
          <Th>{t("reports.col.customer")}</Th>
          <Th>{t("reports.col.total")}</Th>
          <Th>{t("reports.col.paymentMethod")}</Th>
          <Th>{t("reports.col.voidedBy")}</Th>
          <Th>{t("reports.col.voidedAt")}</Th>
          <Th>{t("reports.col.reason")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.sale_id}>
            <Td className="font-medium">#{r.sale_id}</Td>
            <Td>{r.customer_name || "—"}</Td>
            <Td className="text-red-600">{fmt(r.total_amount)}</Td>
            <Td>{r.payment_method.toUpperCase()}{r.is_credit ? " (CREDIT)" : ""}</Td>
            <Td>{r.voided_by_email || "—"}</Td>
            <Td className="text-gray-500">{r.voided_at ? new Date(r.voided_at).toLocaleString() : "—"}</Td>
            <Td>{r.void_reason || "—"}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <Td colSpan={2}>{t("reports.col.total")}</Td>
          <Td className="text-red-600">{fmt(totalAmount)}</Td>
          <Td colSpan={4}></Td>
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
    <table className="app-table">
      <thead>
        <tr>
          <Th>{t("reports.col.date")}</Th>
          <Th>{t("reports.col.cash")}</Th>
          <Th>{t("reports.col.momo")}</Th>
          <Th>{t("reports.col.creditSales")}</Th>
          <Th>{t("reports.col.paymentsReceived")}</Th>
          <Th>{t("reports.col.netCash")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            <Td>{r.date}</Td>
            <Td>{fmt(r.cash_sales)}</Td>
            <Td>{fmt(r.momo_sales)}</Td>
            <Td>{fmt(r.credit_sales)}</Td>
            <Td>{fmt(r.payments_received)}</Td>
            <Td className="font-medium text-green-700">{fmt(r.net)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
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
