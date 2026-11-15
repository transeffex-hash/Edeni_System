"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiDelete, apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import ProductSearch from "@/components/ProductSearch";
import BarcodeScannerModal, { useHardwareScanner } from "@/components/BarcodeScanner";
import WhatsAppReceiptModal from "@/components/WhatsAppReceiptModal";
import SaleEditorModal from "@/components/SaleEditorModal";
import { useConfirm } from "@/hooks/useConfirm";

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

type SaleItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
};

type SaleCreate = {
  payment_method: "cash" | "momo";
  is_credit: boolean;
  customer_name?: string | null;
  due_date?: string | null;
  items: { product_id: number; quantity: number; unit?: string | null; unit_price: number }[];
};

type SaleListItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

type SaleDetail = {
  sale_id: number;
  status: string;
  total_amount: number;
  customer_name: string | null;
  updated_at: string | null;
  items: SaleListItem[];
};

type RecentSale = {
  sale_id: number;
  status: string;
  total_amount: number;
  payment_method: string;
  is_credit: boolean;
  customer_name: string | null;
  customer_id: number | null;
  customer_phone: string | null;
  created_by_user_id: number;
  created_at: string;
  items_count: number;
  paid_total: number;
  balance_due: number;
  can_edit: boolean;
  items: { product_name: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
};

type BarcodeLookup = {
  product: ProductWithStock;
  unit: { id: number; name: string; selling_price: number | null } | null;
};

export default function SellPage() {
  const t = useTranslations();
  const { confirm, Dialog } = useConfirm();
  const me = useAuthStore((s) => s.me);
  const isBoss = me?.role === "boss";
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [productSearchKey, setProductSearchKey] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unit, setUnit] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo">("cash");
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [items, setItems] = useState<SaleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);

  // Drafts
  const [drafts, setDrafts] = useState<SaleDetail[]>([]);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  // Barcode scanning
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // WhatsApp + edit modals
  const [waSale, setWaSale] = useState<{ id: number; phone: string | null } | null>(null);
  const [editSaleId, setEditSaleId] = useState<number | null>(null);

  useEffect(() => {
    if (customerName.trim().length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const data = await apiGet<{ customers: string[] }>(
          `/api/sales/customers?search=${encodeURIComponent(customerName)}`
        );
        setCustomerSuggestions(data.customers);
        setShowSuggestions(data.customers.length > 0);
      } catch {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [customerName]);

  // Recent sales
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesLimit, setSalesLimit] = useState(10);
  const [salesSearch, setSalesSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedProduct) {
      setUnits([]);
      setUnit("");
      return;
    }
    (async () => {
      try {
        const data = await apiGet<ProductUnit[]>(`/api/inventory/products/${selectedProduct.id}/units`);
        setUnits(data);
        const base = data.find((u) => u.is_base);
        setUnit(base?.name ?? (data[0]?.name ?? ""));
        if (base?.selling_price != null) setUnitPrice(String(base.selling_price));
      } catch {
        setUnits([]);
        setUnit("");
      }
    })();
  }, [selectedProduct?.id]);

  const loadRecentSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const data = await apiGet<RecentSale[]>(`/api/sales/recent?limit=${salesLimit}`);
      setRecentSales(data);
    } catch {
      setRecentSales([]);
    } finally {
      setSalesLoading(false);
    }
  }, [salesLimit]);

  const loadDrafts = useCallback(async () => {
    try {
      const data = await apiGet<SaleDetail[]>("/api/sales/drafts");
      setDrafts(data);
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    loadRecentSales();
    loadDrafts();
  }, [loadRecentSales, loadDrafts]);

  // Autosave the cart as a server-side draft so an unfinished sale survives
  // a refresh, a closed tab, or switching to another screen.
  useEffect(() => {
    if (items.length === 0) return;
    const id = setTimeout(async () => {
      try {
        const res = await apiPost<{ id: number }>("/api/sales/drafts", {
          id: draftId,
          customer_name: customerName.trim() || null,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit: i.unit,
            unit_price: i.unit_price,
          })),
        });
        setDraftId(res.id);
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2500);
      } catch {
        // autosave is best-effort; the cart stays in memory
      }
    }, 800);
    return () => clearTimeout(id);
  }, [items, customerName, draftId]);

  async function resumeDraft(d: SaleDetail) {
    try {
      const full = await apiGet<SaleDetail>(`/api/sales/${d.sale_id}`);
      setItems(
        full.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price,
        }))
      );
      setCustomerName(full.customer_name ?? "");
      setDraftId(full.sale_id);
      setError(null);
      setSuccess(null);
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToLoad"));
    }
  }

  async function discardDraft(id: number) {
    try {
      await apiDelete(`/api/sales/drafts/${id}`);
      if (draftId === id) {
        setDraftId(null);
        setItems([]);
      }
      await loadDrafts();
    } catch {
      // ignore
    }
  }

  // Hardware barcode scanner: works anywhere on this page — a scanner "types"
  // the code fast and presses Enter; we catch that burst and look it up.
  const handleBarcode = useCallback(
    async (code: string) => {
      setScanOpen(false);
      setError(null);
      try {
        const d = await apiGet<BarcodeLookup>(
          `/api/inventory/products/by-barcode/${encodeURIComponent(code)}`
        );
        const unitName = d.unit?.name ?? null;
        const unitPrice = d.unit?.selling_price ?? null;
        if (unitPrice == null) {
          // No default price on this unit: pre-select it so the cashier only
          // has to type the price and press "Add item".
          setSelectedProduct(d.product);
          setQuantity("1");
          setScanFeedback(`${d.product.name}: ${t("barcode.enterPrice")}`);
          setTimeout(() => setScanFeedback(null), 4000);
          return;
        }
        setItems((prev) => {
          const idx = prev.findIndex(
            (i) => i.product_id === d.product.id && (i.unit ?? null) === unitName
          );
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
            return copy;
          }
          return [
            ...prev,
            {
              product_id: d.product.id,
              product_name: d.product.name,
              quantity: 1,
              unit: unitName,
              unit_price: unitPrice,
            },
          ];
        });
        setScanFeedback(`✓ ${d.product.name}${unitName ? ` (${unitName})` : ""}`);
        setTimeout(() => setScanFeedback(null), 3000);
      } catch (e: any) {
        const msg = e?.status === 404
          ? t("barcode.notFound", { code })
          : e?.message ?? t("barcode.notFound", { code });
        setScanFeedback(`⚠ ${msg}`);
        setTimeout(() => setScanFeedback(null), 5000);
      }
    },
    [t]
  );

  useHardwareScanner(handleBarcode, !scanOpen && editSaleId === null && waSale === null);

  const total = useMemo(() => {
    return items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  }, [items]);

  function addItem() {
    if (!selectedProduct) {
      setError(`${t("sell.product")} ${t("errors.required")}`);
      return;
    }
    const qtyNum = Number(quantity);
    const priceNum = Number(unitPrice);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      setError(`${t("sell.quantity")} ${t("errors.required")}`);
      return;
    }
    if (!unitPrice || isNaN(priceNum) || priceNum < 0) {
      setError(`${t("sell.unitPrice")} ${t("errors.required")}`);
      return;
    }
    setError(null);
    setItems((prev) => [...prev, {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: qtyNum,
      unit: unit ? unit : null,
      unit_price: priceNum,
    }]);
    setSelectedProduct(null);
    setProductSearchKey((k) => k + 1);
    setQuantity("");
    setUnitPrice("");
  }

  function removeItem(idx: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0 && draftId) {
        apiDelete(`/api/sales/drafts/${draftId}`).catch(() => {});
        setDraftId(null);
      }
      return next;
    });
  }

  async function submitSale() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (items.length === 0) {
      setSubmitting(false);
      setError(t("errors.addAtLeastOne"));
      return;
    }

    if (isCredit && !customerName.trim()) {
      setSubmitting(false);
      setError(t("errors.customerRequired"));
      return;
    }

    const payload: SaleCreate = {
      payment_method: paymentMethod,
      is_credit: isCredit,
      customer_name: customerName.trim() || null,
      due_date: isCredit ? (dueDate || null) : null,
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price })),
    };

    try {
      const res = await apiPost<{ id: number; total_amount: number }>(
        draftId ? `/api/sales/drafts/${draftId}/checkout` : "/api/sales/",
        payload
      );
      setItems([]);
      setCustomerName("");
      setIsCredit(false);
      setDueDate("");
      setDraftId(null);
      setLastSaleId(res.id);
      setSuccess(t("labels.savedSale", { id: res.id }));
      await Promise.all([loadRecentSales(), loadDrafts()]);
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToSaveSale"));
    } finally {
      setSubmitting(false);
    }
  }

  async function doVoid(saleId: number) {
    try {
      await fetch(API_BASE + `/api/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "" }),
      });
      await loadRecentSales();
    } catch {
      // ignore
    }
  }

  function askVoid(saleId: number) {
    confirm(t("products.voidConfirm"), () => doVoid(saleId));
  }

  function formatDateTime(d: string): string {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  }

  const filteredSales = useMemo(() => {
    if (!salesSearch) return recentSales;
    const q = salesSearch.toLowerCase();
    return recentSales.filter((s) =>
      s.customer_name?.toLowerCase().includes(q) ||
      String(s.sale_id).includes(q) ||
      s.items.some((i) => i.product_name.toLowerCase().includes(q))
    );
  }, [recentSales, salesSearch]);

  return (
    <div className="space-y-6">
      <h1 className="app-page-title">{t("sell.title")}</h1>

      {/* Drafts (unfinished sales) */}
      {drafts.length > 0 && (
        <div className="app-card p-4 space-y-2">
          <div className="text-sm font-semibold text-gray-700">{t("drafts.title")}</div>
          <div className="flex flex-wrap gap-2">
            {drafts.map((d) => (
              <div
                key={d.sale_id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  draftId === d.sale_id
                    ? "border-[#0a7e6b] bg-[#0a7e6b]/10 text-[#0a7e6b]"
                    : "border-black/10 hover:border-[#0a7e6b]/50 text-gray-700"
                }`}
                onClick={() => resumeDraft(d)}
              >
                <span className="font-medium">
                  {d.customer_name || t("drafts.unnamed", { id: d.sale_id })}
                </span>
                <span className="text-xs text-gray-400">
                  {d.items.length} · {d.total_amount.toFixed(0)}
                </span>
                <button
                  className="text-gray-300 hover:text-red-500 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    discardDraft(d.sale_id);
                  }}
                  type="button"
                  aria-label={t("drafts.discard")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sale Form */}
      <div className="app-card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="app-label">{t("sell.product")}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <ProductSearch
                  key={productSearchKey}
                  value={selectedProduct}
                  onSelect={setSelectedProduct}
                  placeholder={t("sell.product")}
                />
              </div>
              <button
                className="app-btn-outline whitespace-nowrap"
                onClick={() => setScanOpen(true)}
                type="button"
                title={t("barcode.scanTitle")}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {scanFeedback ? (
              <p className={`text-xs font-medium ${scanFeedback.startsWith("⚠") ? "text-red-600" : "text-[#0a7e6b]"}`}>
                {scanFeedback}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("sell.quantity")}</label>
            <input
              className="app-input"
              type="number"
              min={0.001}
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("labels.unit")}</label>
            <select
              className="app-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={units.length === 0}
            >
              {units.length === 0 ? <option value="">{t("labels.default")}</option> : null}
              {units.map((u) => {
                const available = selectedProduct ? selectedProduct.total_stock / u.factor_to_base : 0;
                return (
                  <option key={u.id} value={u.name}>
                    {u.name} ({available.toFixed(2)} {u.name})
                  </option>
                );
              })}
            </select>
            {selectedProduct ? (
              <p className="text-xs text-gray-500">
                {selectedProduct.total_stock} {selectedProduct.unit} {t("products.inStock")}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("sell.unitPrice")}</label>
            <input
              className="app-input"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="app-btn-outline" onClick={addItem} type="button">
            {t("sell.addItem")}
          </button>
          {draftSaved ? (
            <span className="text-xs text-gray-400">{t("drafts.autosaved")}</span>
          ) : null}
        </div>

        {/* Items list with product names and remove buttons */}
        <div className="rounded-xl border border-black/5 overflow-hidden">
          <div className="p-3 border-b border-black/5 text-sm font-semibold text-gray-700 bg-[#f6f7f8]">{t("sell.items")}</div>
          <div>
            {items.map((i, idx) => (
              <div key={idx} className="app-list-row text-sm">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-gray-800">{i.product_name}</span>
                    <span className="text-gray-500 ml-2">{i.quantity} {i.unit ?? ""} × {i.unit_price.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{(i.quantity * i.unit_price).toFixed(2)}</span>
                  <button
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                    onClick={() => removeItem(idx)}
                    type="button"
                  >
                    {t("products.removeItem")}
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? <div className="p-4 text-sm text-gray-500 text-center">{t("sell.noItems")}</div> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("sell.payment")}</label>
            <select
              className="app-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
            >
              <option value="cash">{t("sell.cash")}</option>
              <option value="momo">{t("sell.momo")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("sell.creditSale")}</label>
            <select
              className="app-input"
              value={isCredit ? "yes" : "no"}
              onChange={(e) => setIsCredit(e.target.value === "yes")}
            >
              <option value="no">{t("sell.no")}</option>
              <option value="yes">{t("sell.yes")}</option>
            </select>
          </div>

          {isCredit && (
            <div className="space-y-1.5">
              <label className="app-label">Due date (optional)</label>
              <input
                type="date"
                className="app-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5 relative">
            <label className="app-label">{t("sell.customerName")}</label>
            <input
              className="app-input"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => customerSuggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={t("sell.customerNamePlaceholder")}
            />
            {showSuggestions && customerSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-black/10 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                {customerSuggestions.map((c) => (
                  <li
                    key={c}
                    className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                    onMouseDown={() => {
                      setCustomerName(c);
                      setShowSuggestions(false);
                    }}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-black/5">
          <div className="text-base font-semibold text-gray-800">
            {t("sell.total")}: {total.toFixed(2)}
          </div>
          <div className="flex items-center gap-3">
            {lastSaleId && (
              <>
                <a
                  href={`${API_BASE}/api/sales/${lastSaleId}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-btn-ghost text-sm"
                >
                  {t("products.viewReceipt")}
                </a>
                <button
                  className="app-btn-ghost text-sm text-[#25D366]"
                  onClick={() => setWaSale({ id: lastSaleId, phone: null })}
                  type="button"
                >
                  WhatsApp
                </button>
              </>
            )}
            <button
              className="app-btn-primary"
              onClick={submitSale}
              disabled={submitting}
              type="button"
            >
              {submitting ? t("sell.saving") : t("sell.saveSale")}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}
      </div>

      {/* Recent Sales Table */}
      <div className="app-card overflow-hidden">
        <div className="p-4 border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold text-sm text-gray-700">{t("products.recentSales")}</div>
          <div className="flex items-center gap-2">
            <input
              className="app-input text-sm max-w-[200px]"
              placeholder={t("products.search")}
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
            />
            <select
              className="app-input text-sm max-w-[100px]"
              value={salesLimit}
              onChange={(e) => setSalesLimit(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        {salesLoading ? (
          <div className="p-5 text-sm text-gray-500 text-center">{t("dashboard.loading")}</div>
        ) : filteredSales.length === 0 ? (
          <div className="p-5 text-sm text-gray-500 text-center">{t("products.noSales")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("products.saleId")}</th>
                  <th>{t("products.items")}</th>
                  <th>{t("products.amount")}</th>
                  <th>{t("products.payment")}</th>
                  <th>{t("products.customer")}</th>
                  <th>{t("products.date")}</th>
                  <th>{t("products.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => (
                  <tr key={s.sale_id}>
                    <td className="font-medium">#{s.sale_id}</td>
                    <td className="text-gray-500">
                      {s.items.slice(0, 2).map((i, i2) => (
                        <span key={i2} className="text-xs">
                          {i.quantity} {i.unit} {i.product_name}{i2 < s.items.length - 1 ? ", " : ""}
                        </span>
                      ))}
                      {s.items.length > 2 ? <span className="text-xs text-gray-400"> +{s.items.length - 2} more</span> : null}
                    </td>
                    <td className="font-semibold">
                      {s.total_amount.toFixed(2)}
                      {s.balance_due > 0.005 ? (
                        <span className="block text-[10px] font-normal text-orange-600">
                          {t("editSale.balanceDue")}: {s.balance_due.toFixed(0)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="text-xs font-medium uppercase">{s.payment_method}</span>
                      {s.is_credit && <span className="text-xs text-orange-600 ml-1">credit</span>}
                    </td>
                    <td className="text-gray-500">{s.customer_name ?? "—"}</td>
                    <td className="text-gray-500 text-xs">{formatDateTime(s.created_at)}</td>
                    <td>
                      <div className="flex gap-2">
                        <a
                          href={`${API_BASE}/api/sales/${s.sale_id}/receipt`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {t("products.receipt")}
                        </a>
                        <button
                          className="text-xs text-[#25D366] hover:text-[#1ebe5d] font-medium"
                          onClick={() => setWaSale({ id: s.sale_id, phone: s.customer_phone })}
                          type="button"
                        >
                          WhatsApp
                        </button>
                        {s.can_edit && (
                          <button
                            className="text-xs text-[#0a7e6b] hover:text-[#086b5b] font-medium"
                            onClick={() => setEditSaleId(s.sale_id)}
                            type="button"
                          >
                            {t("editSale.edit")}
                          </button>
                        )}
                        {(me?.id === s.created_by_user_id || isBoss) && (
                          <button
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                            onClick={() => askVoid(s.sale_id)}
                            type="button"
                          >
                            {t("products.voidSale")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scanOpen && (
        <BarcodeScannerModal onDetected={handleBarcode} onClose={() => setScanOpen(false)} />
      )}
      {waSale && (
        <WhatsAppReceiptModal saleId={waSale.id} defaultPhone={waSale.phone} onClose={() => setWaSale(null)} />
      )}
      {editSaleId !== null && (
        <SaleEditorModal
          saleId={editSaleId}
          onClose={() => setEditSaleId(null)}
          onChanged={loadRecentSales}
        />
      )}
    <Dialog />
    </div>
  );
}
