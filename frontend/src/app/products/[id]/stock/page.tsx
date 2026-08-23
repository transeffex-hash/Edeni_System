"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useConfirm } from "@/hooks/useConfirm";

type StockBatchCreate = {
  product_id: number;
  quantity: number;
  unit?: string | null;
  cost_price: number;
  expiry_date?: string | null;
  branch_id?: number | null;
  is_credit_purchase?: boolean;
  supplier_name?: string;
  amount_paid?: number;
};

type StockBatch = {
  id: number;
  product_id: number;
  quantity: number;
  cost_price: number;
  expiry_date: string | null;
  created_at: string;
};

type ProductUnit = { id: number; product_id: number; name: string; factor_to_base: number; is_base: boolean };
type Branch = { id: number; name: string };

export default function AddStockPage() {
  const t = useTranslations();
  const { confirm, Dialog } = useConfirm();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  const me = useAuthStore((s) => s.me);
  const isBoss = me?.role === "boss";

  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unit, setUnit] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function loadBatches() {
    try {
      const data = await apiGet<StockBatch[]>(`/api/inventory/products/${productId}/stock`);
      setBatches(data);
    } catch {
      setBatches([]);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<ProductUnit[]>(`/api/inventory/products/${productId}/units`);
        setUnits(data);
        const base = data.find((u) => u.is_base);
        setUnit(base?.name ?? (data[0]?.name ?? ""));
      } catch {
        setUnits([]);
        setUnit("");
      }

      if (me?.branch_id === null) {
        try {
          const b = await apiGet<Branch[]>("/api/branches");
          setBranches(b);
          setBranchId(b.length === 1 ? b[0].id : "");
        } catch {
          setBranches([]);
        }
      } else if (me?.branch_id !== undefined) {
        setBranchId(me.branch_id);
      }
    })();
    loadBatches();
  }, [productId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const qtyNum = Number(quantity);
    const costNum = Number(costPrice);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      setError(`${t("stock.quantity")} ${t("errors.required")}`);
      setLoading(false);
      return;
    }
    if (!costPrice || isNaN(costNum) || costNum < 0) {
      setError(`${t("stock.costPrice")} ${t("errors.required")}`);
      setLoading(false);
      return;
    }
    if (me?.branch_id === null && branches.length > 1 && !branchId) {
      setError(`${t("team.branch")} ${t("errors.required")}`);
      setLoading(false);
      return;
    }
    if (isCredit && !supplierName.trim()) {
      setError(`${t("stock.supplierName")} ${t("errors.required")}`);
      setLoading(false);
      return;
    }

    const payload: StockBatchCreate = {
      product_id: productId,
      quantity: qtyNum,
      unit: unit ? unit : null,
      cost_price: costNum,
      expiry_date: expiryDate ? expiryDate : null,
      branch_id: me?.branch_id === null ? (branchId ? Number(branchId) : null) : me?.branch_id ?? null,
      is_credit_purchase: isCredit,
    };
    if (isCredit) {
      payload.supplier_name = supplierName.trim();
      payload.amount_paid = amountPaid ? Number(amountPaid) : 0;
    }

    try {
      await apiPost("/api/inventory/stock", payload);
      setQuantity("");
      setCostPrice("");
      setExpiryDate("");
      setIsCredit(false);
      setSupplierName("");
      setAmountPaid("");
      if (me?.branch_id === null) setBranchId(branches.length === 1 ? branches[0].id : "");
      await loadBatches();
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToAddStock"));
    } finally {
      setLoading(false);
    }
  }

  function startEdit(batch: StockBatch) {
    setEditingBatch(batch);
    setEditQty(String(batch.quantity));
    setEditCost(String(batch.cost_price));
    setEditExpiry(batch.expiry_date ?? "");
  }

  function cancelEdit() {
    setEditingBatch(null);
    setEditQty("");
    setEditCost("");
    setEditExpiry("");
  }

  async function saveEdit() {
    if (!editingBatch) return;
    setEditLoading(true);

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
      await loadBatches();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setEditLoading(false);
    }
  }

  async function doDeleteBatch(batch: StockBatch) {
    try {
      await fetch(API_BASE + `/api/inventory/stock/${batch.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await loadBatches();
    } catch {
      // ignore
    }
  }

  function askDeleteBatch(batch: StockBatch) {
    confirm(t("stock.deleteConfirm"), () => doDeleteBatch(batch));
  }

  function formatDate(d: string): string {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="app-page-title">{t("stock.title")}</h1>
        <button className="app-btn-ghost" onClick={() => router.push("/products")} type="button">
          ← {t("products.title")}
        </button>
      </div>

      <form className="app-card p-5 space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("stock.quantity")}</label>
            <input
              className="app-input"
              type="number"
              min={0.001}
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
              required
            />
          </div>

          {me?.branch_id === null && (
            <div className="space-y-1.5">
              <label className="app-label">{t("team.branch")}</label>
              <select
                className="app-input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
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

          <div className="space-y-1.5">
            <label className="app-label">{t("labels.unit")}</label>
            <select
              className="app-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={units.length === 0}
            >
              {units.length === 0 ? <option value="">{t("labels.default")}</option> : null}
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("stock.costPrice")}</label>
            <input
              className="app-input"
              type="number"
              min={0}
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="app-label">{t("stock.expiryDateOptional")}</label>
            <input
              className="app-input"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
              />
              {t("stock.boughtOnCredit")}
            </label>
          </div>

          {isCredit && (
            <>
              <div className="space-y-1.5">
                <label className="app-label">{t("stock.supplierName")}</label>
                <input
                  className="app-input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder={t("stock.supplierNamePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="app-label">{t("stock.amountPaidNow")}</label>
                <input
                  className="app-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">{t("stock.creditHint")}</p>
              </div>
            </>
          )}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="app-btn-primary"
          disabled={loading}
          type="submit"
        >
          {loading ? t("stock.saving") : t("stock.save")}
        </button>
      </form>

      {/* Stock History Table */}
      <div className="app-card overflow-hidden">
        <div className="p-4 border-b border-black/5 font-semibold text-sm text-gray-700">
          {t("stock.history")}
        </div>
        {batches.length === 0 ? (
          <div className="p-5 text-sm text-gray-500 text-center">{t("stock.noStock")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("stock.quantity")}</th>
                  <th>{t("stock.costPrice")}</th>
                  <th>{t("stock.expiryDateOptional")}</th>
                  <th>{t("stock.addedOn")}</th>
                  {isBoss && <th></th>}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    {editingBatch?.id === b.id ? (
                      <>
                        <td>
                          <input
                            className="app-input"
                            type="number"
                            min={0.001}
                            step="0.001"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        </td>
                        <td>
                          <input
                            className="app-input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={editCost}
                            onChange={(e) => setEditCost(e.target.value)}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        </td>
                        <td>
                          <input
                            className="app-input"
                            type="date"
                            value={editExpiry}
                            onChange={(e) => setEditExpiry(e.target.value)}
                          />
                        </td>
                        <td>{formatDate(b.created_at)}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="app-btn-primary text-xs"
                              onClick={saveEdit}
                              disabled={editLoading}
                              type="button"
                            >
                              {editLoading ? t("stock.updating") : t("stock.update")}
                            </button>
                            <button
                              className="app-btn-ghost text-xs"
                              onClick={cancelEdit}
                              type="button"
                            >
                              {t("stock.cancel")}
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-medium">{b.quantity}</td>
                        <td>{b.cost_price.toFixed(2)}</td>
                        <td>{b.expiry_date ? formatDate(b.expiry_date) : "—"}</td>
                        <td>{formatDate(b.created_at)}</td>
                        {isBoss && (
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                onClick={() => startEdit(b)}
                                type="button"
                              >
                                {t("stock.edit")}
                              </button>
                              <button
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                                onClick={() => askDeleteBatch(b)}
                                type="button"
                              >
                                {t("stock.delete")}
                              </button>
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
        )}
        {!isBoss && batches.length > 0 && (
          <div className="p-3 border-t border-black/5 text-xs text-gray-400 text-center">
            {t("stock.bossOnlyEdit")}
          </div>
        )}
      </div>
    </div>
    <Dialog />
    </>
  );
}
