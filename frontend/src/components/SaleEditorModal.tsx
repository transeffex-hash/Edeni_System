"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import ProductSearch from "@/components/ProductSearch";

type ProductWithStock = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  total_stock: number;
  latest_cost_price: number | null;
  nearest_expiry: string | null;
  last_stock_date: string | null;
  batch_count: number;
};

type ProductUnit = {
  id: number;
  product_id: number;
  name: string;
  factor_to_base: number;
  is_base: boolean;
  selling_price: number | null;
};

export type SaleDetail = {
  sale_id: number;
  status: string;
  is_voided: boolean;
  total_amount: number;
  payment_method: string;
  is_credit: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  can_edit: boolean;
  paid_total: number;
  balance_due: number;
  items: {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
  }[];
  payments: { id: number; method: string; amount: number; created_at: string | null }[];
};

type Props = {
  saleId: number;
  onClose: () => void;
  onChanged?: () => void;
};

export default function SaleEditorModal({ saleId, onClose, onChanged }: Props) {
  const t = useTranslations();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // edit price state per item id
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});

  // add item state
  const [product, setProduct] = useState<ProductWithStock | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unit, setUnit] = useState("");

  // payment state
  const [payMethod, setPayMethod] = useState<"cash" | "momo">("cash");
  const [payAmount, setPayAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await apiGet<SaleDetail>(`/api/sales/${saleId}`);
      setSale(d);
      setPayAmount(d.balance_due > 0 ? String(d.balance_due) : "");
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToLoad"));
    }
  }, [saleId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!product) {
      setUnits([]);
      setUnit("");
      return;
    }
    (async () => {
      try {
        const data = await apiGet<ProductUnit[]>(`/api/inventory/products/${product.id}/units`);
        setUnits(data);
        const base = data.find((u) => u.is_base) ?? data[0];
        setUnit(base?.name ?? "");
        if (base?.selling_price != null) setPrice(String(base.selling_price));
      } catch {
        setUnits([]);
        setUnit("");
      }
    })();
  }, [product?.id]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToSaveSale"));
    } finally {
      setBusy(false);
    }
  }

  function savePrice(itemId: number) {
    const v = Number(priceEdits[itemId]);
    if (isNaN(v) || v < 0) return;
    run(() => apiPatch(`/api/sales/${saleId}/items/${itemId}`, { unit_price: v }));
  }

  function removeItem(itemId: number) {
    run(() => apiDelete(`/api/sales/${saleId}/items/${itemId}`));
  }

  function addItem() {
    const q = Number(qty);
    const p = Number(price);
    if (!product || !qty || isNaN(q) || q <= 0) return;
    if (!price || isNaN(p) || p < 0) return;
    run(() =>
      apiPost(`/api/sales/${saleId}/items`, {
        product_id: product.id,
        quantity: q,
        unit: unit || null,
        unit_price: p,
      }).then(() => {
        setProduct(null);
        setSearchKey((k) => k + 1);
        setQty("");
        setPrice("");
      })
    );
  }

  function addPayment() {
    const a = Number(payAmount);
    if (!payAmount || isNaN(a) || a <= 0) return;
    run(() =>
      apiPost(`/api/sales/${saleId}/payments`, { method: payMethod, amount: a }).then(() =>
        setPayAmount("")
      )
    );
  }

  const editable = sale?.can_edit && !sale?.is_voided;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-black/5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              {t("editSale.title", { id: saleId })}
            </h2>
            {sale?.customer_name ? (
              <p className="text-xs text-gray-500 mt-0.5">{sale.customer_name}</p>
            ) : null}
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose} type="button">×</button>
        </div>

        {!sale ? (
          <div className="p-6 text-sm text-gray-500 text-center">{error ?? t("dashboard.loading")}</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Items */}
            <div className="rounded-xl border border-black/5 overflow-hidden">
              <div className="p-3 border-b border-black/5 text-sm font-semibold text-gray-700 bg-[#f6f7f8]">
                {t("sell.items")}
              </div>
              {sale.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-black/5 last:border-0 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-800">{i.product_name}</span>
                    <span className="text-gray-500 ml-2">{i.quantity} {i.unit}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editable ? (
                      <>
                        <input
                          className="app-input !w-24 !py-1 text-sm"
                          type="number"
                          min={0}
                          step="0.01"
                          value={priceEdits[i.id] ?? i.unit_price}
                          onChange={(e) => setPriceEdits((p) => ({ ...p, [i.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && savePrice(i.id)}
                        />
                        <button
                          className="text-xs text-blue-600 font-medium"
                          onClick={() => savePrice(i.id)}
                          disabled={busy}
                          type="button"
                        >
                          {t("editSale.savePrice")}
                        </button>
                        <button
                          className="text-xs text-red-600 font-medium disabled:opacity-40"
                          onClick={() => removeItem(i.id)}
                          disabled={busy || sale.items.length <= 1}
                          type="button"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500">{i.unit_price.toFixed(2)}</span>
                    )}
                    <span className="font-medium w-20 text-right">{i.line_total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add item */}
            {editable && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700">{t("editSale.addItem")}</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <ProductSearch key={searchKey} value={product} onSelect={setProduct} placeholder={t("sell.product")} />
                  </div>
                  <input
                    className="app-input"
                    type="number"
                    min={0.001}
                    step="0.001"
                    placeholder={t("sell.quantity")}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                  <select className="app-input" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={units.length === 0}>
                    {units.length === 0 ? <option value="">{t("labels.default")}</option> : null}
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      className="app-input"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={t("sell.unitPrice")}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <button className="app-btn-primary whitespace-nowrap" onClick={addItem} disabled={busy || !product} type="button">
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payments */}
            <div className="rounded-xl border border-black/5 overflow-hidden">
              <div className="p-3 border-b border-black/5 flex items-center justify-between bg-[#f6f7f8]">
                <span className="text-sm font-semibold text-gray-700">{t("editSale.payments")}</span>
                <span className="text-sm">
                  {sale.is_credit ? (
                    <span className="text-orange-600 font-medium">{t("editSale.creditNote")}</span>
                  ) : sale.balance_due > 0.005 ? (
                    <span className="text-orange-600 font-medium">
                      {t("editSale.balanceDue")}: {sale.balance_due.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-green-700 font-medium">{t("editSale.paidInFull")}</span>
                  )}
                </span>
              </div>
              {sale.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-black/5 last:border-0 text-sm">
                  <span className="uppercase text-xs font-medium text-gray-600">{p.method}</span>
                  <span className="font-medium">{p.amount.toFixed(2)}</span>
                </div>
              ))}
              {sale.payments.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">{t("editSale.noPayments")}</div>
              )}
            </div>

            {editable && !sale.is_credit && sale.balance_due > 0.005 && (
              <div className="flex items-end gap-2">
                <select className="app-input max-w-[120px]" value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                  <option value="cash">{t("sell.cash")}</option>
                  <option value="momo">{t("sell.momo")}</option>
                </select>
                <input
                  className="app-input flex-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={t("editSale.amount")}
                />
                <button className="app-btn-primary" onClick={addPayment} disabled={busy} type="button">
                  {t("editSale.recordPayment")}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-black/5">
              <span className="font-semibold text-gray-800">
                {t("sell.total")}: {sale.total_amount.toFixed(2)}
              </span>
              <a
                href={`${API_BASE}/api/sales/${sale.sale_id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="app-btn-ghost text-sm"
              >
                {t("products.viewReceipt")}
              </a>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
