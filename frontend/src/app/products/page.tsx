"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
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

type Branch = { id: number; business_id: number; name: string; is_active: boolean };

type StockBatch = {
  id: number;
  product_id: number;
  quantity: number;
  cost_price: number;
  expiry_date: string | null;
  created_at: string;
};

type CreateProduct = { name: string; sku?: string | null; unit?: string };

type InventorySummary = {
  total_products: number;
  total_stock_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
};

export default function ProductsPage() {
  const t = useTranslations();
  const { confirm, Dialog } = useConfirm();
  const me = useAuthStore((s) => s.me);
  const isBoss = me?.role === "boss";

  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Add product form
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unit");
  const [sku, setSku] = useState("");
  const [creating, setCreating] = useState(false);

  // Add stock modal
  const [stockProduct, setStockProduct] = useState<ProductWithStock | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [stockExpiry, setStockExpiry] = useState("");
  const [stockBranchId, setStockBranchId] = useState<number | "">("");
  const [stockIsCredit, setStockIsCredit] = useState(false);
  const [stockSupplier, setStockSupplier] = useState("");
  const [stockAmountPaid, setStockAmountPaid] = useState("");
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);

  // Edit batch
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editExpiry, setEditExpiry] = useState("");

  const [summary, setSummary] = useState<InventorySummary | null>(null);

  const loadProducts = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    const currentOffset = reset ? 0 : offset;
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(currentOffset));
    if (search) params.set("search", search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    try {
      const data = await apiGet<ProductWithStock[]>(`/api/inventory/products/with-stock?${params.toString()}`);
      if (reset) {
        setProducts(data);
      } else {
        setProducts((prev) => [...prev, ...data]);
      }
      setOffset(currentOffset + data.length);
      setHasMore(data.length === limit);
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [offset, search, dateFrom, dateTo, t]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiGet<InventorySummary>("/api/inventory/summary");
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    if (me?.branch_id !== null) return;
    try {
      const data = await apiGet<Branch[]>("/api/branches");
      setBranches(data);
    } catch {
      setBranches([]);
    }
  }, [me]);

  useEffect(() => {
    loadProducts(true);
    loadSummary();
    loadBranches();
  }, []);

  function applyFilters() {
    setOffset(0);
    loadProducts(true);
  }

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
    setTimeout(() => loadProducts(true), 0);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(`${t("products.name")} ${t("errors.required")}`);
      return;
    }
    if (!unit.trim()) {
      setError(`${t("products.unit")} ${t("errors.required")}`);
      return;
    }

    setCreating(true);
    const payload: CreateProduct = { name, unit, sku: sku ? sku : null };
    try {
      await apiPost("/api/inventory/products", payload);
      setName("");
      setSku("");
      setUnit("unit");
      setShowAddForm(false);
      await loadProducts(true);
      await loadSummary();
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToCreateProduct"));
    } finally {
      setCreating(false);
    }
  }

  async function openStockModal(p: ProductWithStock) {
    setStockProduct(p);
    setStockQty("");
    setStockCost("");
    setStockExpiry("");
    setStockIsCredit(false);
    setStockSupplier("");
    setStockAmountPaid("");
    setStockError(null);
    setEditingBatch(null);
    if (me?.branch_id === null) {
      setStockBranchId(branches.length === 1 ? branches[0].id : "");
    } else {
      setStockBranchId(me?.branch_id ?? "");
    }
    try {
      const data = await apiGet<StockBatch[]>(`/api/inventory/products/${p.id}/stock`);
      setStockBatches(data);
    } catch {
      setStockBatches([]);
    }
  }

  function closeStockModal() {
    setStockProduct(null);
    setStockBatches([]);
    setEditingBatch(null);
  }

  async function addStock() {
    if (!stockProduct) return;
    const qtyNum = Number(stockQty);
    const costNum = Number(stockCost);
    if (!stockQty || isNaN(qtyNum) || qtyNum <= 0) {
      setStockError(`${t("stock.quantity")} ${t("errors.required")}`);
      return;
    }
    if (!stockCost || isNaN(costNum) || costNum < 0) {
      setStockError(`${t("stock.costPrice")} ${t("errors.required")}`);
      return;
    }
    if (me?.branch_id === null && branches.length > 1 && !stockBranchId) {
      setStockError(`${t("team.branch")} ${t("errors.required")}`);
      return;
    }
    if (stockIsCredit && !stockSupplier.trim()) {
      setStockError(`${t("stock.supplierName")} ${t("errors.required")}`);
      return;
    }

    setStockLoading(true);
    setStockError(null);
    try {
      const payload: any = {
        product_id: stockProduct.id,
        quantity: qtyNum,
        cost_price: costNum,
        expiry_date: stockExpiry ? stockExpiry : null,
        is_credit_purchase: stockIsCredit,
      };
      if (stockIsCredit) {
        payload.supplier_name = stockSupplier.trim();
        payload.amount_paid = stockAmountPaid ? Number(stockAmountPaid) : 0;
      }
      if (me?.branch_id === null) payload.branch_id = stockBranchId ? Number(stockBranchId) : null;
      await apiPost("/api/inventory/stock", payload);
      setStockQty("");
      setStockCost("");
      setStockExpiry("");
      setStockSupplier("");
      setStockAmountPaid("");
      setStockIsCredit(false);
      const data = await apiGet<StockBatch[]>(`/api/inventory/products/${stockProduct.id}/stock`);
      setStockBatches(data);
      await loadProducts(true);
      await loadSummary();
    } catch (e: any) {
      setStockError(e?.message ?? t("errors.failedToAddStock"));
    } finally {
      setStockLoading(false);
    }
  }

  function startEditBatch(b: StockBatch) {
    setEditingBatch(b);
    setEditQty(String(b.quantity));
    setEditCost(String(b.cost_price));
    setEditExpiry(b.expiry_date ?? "");
  }

  async function saveEditBatch() {
    if (!editingBatch) return;
    const body: any = {};
    const qtyNum = Number(editQty);
    const costNum = Number(editCost);
    if (editQty && !isNaN(qtyNum)) body.quantity = qtyNum;
    if (editCost && !isNaN(costNum)) body.cost_price = costNum;
    body.expiry_date = editExpiry ? editExpiry : null;

    try {
      const res = await fetch(API_BASE + `/api/inventory/stock/${editingBatch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed");
      }
      setEditingBatch(null);
      if (stockProduct) {
        const data = await apiGet<StockBatch[]>(`/api/inventory/products/${stockProduct.id}/stock`);
        setStockBatches(data);
      }
      await loadProducts(true);
      await loadSummary();
    } catch (e: any) {
      setStockError(e?.message ?? "Failed");
    }
  }

  async function doDeleteBatch(b: StockBatch) {
    try {
      await fetch(API_BASE + `/api/inventory/stock/${b.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (stockProduct) {
        const data = await apiGet<StockBatch[]>(`/api/inventory/products/${stockProduct.id}/stock`);
        setStockBatches(data);
      }
      await loadProducts(true);
      await loadSummary();
    } catch {
      // ignore
    }
  }

  function askDeleteBatch(b: StockBatch) {
    confirm(t("stock.deleteConfirm"), () => doDeleteBatch(b));
  }

  function formatDate(d: string | null): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  function stockBadge(p: ProductWithStock) {
    if (p.total_stock === 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{t("products.outOfStock")}</span>;
    if (p.total_stock <= 5) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{t("products.lowStock")}</span>;
    return <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{t("products.inStock")}</span>;
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="app-page-title">{t("products.title")}</h1>
        <button className="app-btn-primary" onClick={() => setShowAddForm((v) => !v)} type="button">
          {showAddForm ? "×" : "+"} {t("products.addProduct")}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && summary.total_products > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="app-card p-4">
            <div className="text-xs text-gray-500 font-medium">{t("products.totalProducts")}</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{summary.total_products}</div>
          </div>
          <div className="app-card p-4">
            <div className="text-xs text-gray-500 font-medium">{t("products.totalStockValue")}</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              {summary.total_stock_value.toFixed(0)}
            </div>
          </div>
          <div className="app-card p-4">
            <div className="text-xs text-gray-500 font-medium">{t("products.lowStockItems")}</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {summary.low_stock_items}
            </div>
          </div>
          <div className="app-card p-4">
            <div className="text-xs text-gray-500 font-medium">{t("products.outOfStockItems")}</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {summary.out_of_stock_items}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Form (collapsible) */}
      {showAddForm && (
        <form onSubmit={onCreate} className="app-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="app-label">{t("products.name")}</label>
              <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="app-label">{t("products.unit")}</label>
              <input className="app-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="app-label">{t("products.skuOptional")}</label>
              <input className="app-input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3">
            <button className="app-btn-primary" type="submit" disabled={creating}>
              {creating ? t("products.saving") : t("products.addProduct")}
            </button>
            <button className="app-btn-ghost" type="button" onClick={() => setShowAddForm(false)}>{t("stock.cancel")}</button>
          </div>
        </form>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            className="app-input"
            placeholder={t("products.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <button className="app-btn-ghost" onClick={() => setShowFilters((v) => !v)} type="button">
          {t("products.filter")} ▾
        </button>
      </div>

      {showFilters && (
        <div className="app-card p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <label className="app-label">{t("products.dateFrom")}</label>
            <input className="app-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="app-label">{t("products.dateTo")}</label>
            <input className="app-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button className="app-btn-primary" onClick={applyFilters} type="button">{t("products.filter")}</button>
          <button className="app-btn-ghost" onClick={clearFilters} type="button">{t("products.clearFilters")}</button>
        </div>
      )}

      {/* Stock Table */}
      <div className="app-card overflow-hidden">
        <div className="p-4 border-b border-black/5 font-semibold text-sm text-gray-700">{t("products.list")}</div>
        {loading && products.length === 0 ? (
          <div className="p-5 text-sm text-gray-500 text-center">{t("dashboard.loading")}</div>
        ) : products.length === 0 ? (
          <div className="p-5 text-sm text-gray-500 text-center">{t("products.noProducts")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("products.name")}</th>
                  <th>{t("products.unit")}</th>
                  <th>{t("products.totalStock")}</th>
                  <th>{t("products.costPrice")}</th>
                  <th>{t("products.expiry")}</th>
                  <th>{t("products.lastAdded")}</th>
                  <th>{t("products.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium text-gray-800">{p.name}</td>
                    <td className="text-gray-500">{p.unit}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.total_stock}</span>
                        {stockBadge(p)}
                      </div>
                    </td>
                    <td>{p.latest_cost_price != null ? p.latest_cost_price.toFixed(2) : "—"}</td>
                    <td>{formatDate(p.nearest_expiry)}</td>
                    <td className="text-gray-500">{formatDate(p.last_stock_date)}</td>
                    <td>
                      <button
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        onClick={() => openStockModal(p)}
                        type="button"
                      >
                        {t("products.addStock")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && products.length > 0 && (
          <div className="p-3 border-t border-black/5 text-center">
            <button type="button" onClick={() => loadProducts(false)} className="app-btn-ghost">
              {t("products.loadMore")}
            </button>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeStockModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-black/5 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{t("products.addStockFor", { name: stockProduct.name })}</h2>
              <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={closeStockModal} type="button">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add stock form */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="app-label">{t("stock.quantity")}</label>
                  <input
                    className="app-input"
                    type="number"
                    min={0.001}
                    step="0.001"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="app-label">{t("stock.costPrice")}</label>
                  <input
                    className="app-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={stockCost}
                    onChange={(e) => setStockCost(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="app-label">{t("stock.expiryDateOptional")}</label>
                  <input className="app-input" type="date" value={stockExpiry} onChange={(e) => setStockExpiry(e.target.value)} />
                </div>
                {me?.branch_id === null && (
                  <div className="space-y-1.5 col-span-2">
                    <label className="app-label">{t("team.branch")}</label>
                    <select
                      className="app-input"
                      value={stockBranchId}
                      onChange={(e) => setStockBranchId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">{t("team.selectBranch")}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-span-2 pt-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={stockIsCredit}
                      onChange={(e) => setStockIsCredit(e.target.checked)}
                    />
                    {t("stock.boughtOnCredit")}
                  </label>
                </div>
                {stockIsCredit && (
                  <>
                    <div className="space-y-1.5 col-span-2">
                      <label className="app-label">{t("stock.supplierName")}</label>
                      <input
                        className="app-input"
                        value={stockSupplier}
                        onChange={(e) => setStockSupplier(e.target.value)}
                        placeholder={t("stock.supplierNamePlaceholder")}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="app-label">{t("stock.amountPaidNow")}</label>
                      <input
                        className="app-input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={stockAmountPaid}
                        onChange={(e) => setStockAmountPaid(e.target.value)}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500">{t("stock.creditHint")}</p>
                    </div>
                  </>
                )}
              </div>

              {stockError ? <p className="text-sm text-red-600">{stockError}</p> : null}

              <button className="app-btn-primary w-full" onClick={addStock} disabled={stockLoading} type="button">
                {stockLoading ? t("stock.saving") : t("stock.save")}
              </button>

              {/* Stock history in modal */}
              {stockBatches.length > 0 && (
                <div className="pt-3 border-t border-black/5">
                  <div className="text-sm font-semibold text-gray-700 mb-2">{t("stock.history")}</div>
                  <div className="overflow-x-auto">
                    <table className="app-table">
                      <thead>
                        <tr>
                          <th>{t("stock.quantity")}</th>
                          <th>{t("stock.costPrice")}</th>
                          <th>{t("products.expiry")}</th>
                          <th>{t("stock.addedOn")}</th>
                          {isBoss && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {stockBatches.map((b) => (
                          <tr key={b.id}>
                            {editingBatch?.id === b.id ? (
                              <>
                                <td>
                                  <input className="app-input" type="number" min={0.001} step="0.001" value={editQty} onChange={(e) => setEditQty(e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                                </td>
                                <td>
                                  <input className="app-input" type="number" min={0} step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                                </td>
                                <td>
                                  <input className="app-input" type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
                                </td>
                                <td>{formatDate(b.created_at)}</td>
                                <td>
                                  <div className="flex gap-2">
                                    <button className="app-btn-primary text-xs" onClick={saveEditBatch} type="button">{t("stock.update")}</button>
                                    <button className="app-btn-ghost text-xs" onClick={() => setEditingBatch(null)} type="button">{t("stock.cancel")}</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="font-medium">{b.quantity}</td>
                                <td>{b.cost_price.toFixed(2)}</td>
                                <td>{formatDate(b.expiry_date)}</td>
                                <td className="text-gray-500">{formatDate(b.created_at)}</td>
                                {isBoss && (
                                  <td>
                                    <div className="flex gap-2">
                                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={() => startEditBatch(b)} type="button">{t("stock.edit")}</button>
                                      <button className="text-xs text-red-600 hover:text-red-700 font-medium" onClick={() => askDeleteBatch(b)} type="button">{t("stock.delete")}</button>
                                    </div>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isBoss && (
                    <div className="mt-2 text-xs text-gray-400 text-center">{t("stock.bossOnlyEdit")}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    <Dialog />
    </>
  );
}
