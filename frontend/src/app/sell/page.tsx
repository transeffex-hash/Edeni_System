"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet, apiPost } from "@/lib/api";

type Product = { id: number; name: string; sku: string | null; unit: string };

type ProductUnit = { id: number; product_id: number; name: string; factor_to_base: number; is_base: boolean };

type SaleItem = {
  product_id: number;
  quantity: number;
  unit?: string | null;
  unit_price: number;
};

type SaleCreate = {
  payment_method: "cash" | "momo";
  is_credit: boolean;
  customer_name?: string | null;
  items: SaleItem[];
};

export default function SellPage() {
  const t = useTranslations();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unit, setUnit] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo">("cash");
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const data = await apiGet<Product[]>("/api/inventory/products");
      setProducts(data);
      if (data.length > 0) setProductId(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!productId) {
      setUnits([]);
      setUnit("");
      return;
    }
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
    })();
  }, [productId]);

  const total = useMemo(() => {
    return items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  }, [items]);

  function addItem() {
    if (!productId) return;
    setItems((prev) => [...prev, { product_id: productId, quantity, unit: unit ? unit : null, unit_price: unitPrice }]);
    setQuantity(1);
    setUnitPrice(0);
  }

  async function submitSale() {
    setError(null);
    setSuccess(null);

    if (items.length === 0) {
      setError("Add at least one item");
      return;
    }

    if (isCredit && !customerName.trim()) {
      setError("Customer name is required for credit");
      return;
    }

    const payload: SaleCreate = {
      payment_method: paymentMethod,
      is_credit: isCredit,
      customer_name: isCredit ? customerName.trim() : null,
      items
    };

    try {
      const res = await apiPost<{ id: number; total_amount: number }>("/api/sales/", payload);
      setItems([]);
      setCustomerName("");
      setIsCredit(false);
      setSuccess(`Saved sale #${res.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save sale");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("sell.title")}</h1>

      <div className="border rounded p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm">{t("sell.product")}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={productId ?? ""}
              onChange={(e) => setProductId(Number(e.target.value))}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("sell.quantity")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              min={0.001}
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Unit</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={units.length === 0}
            >
              {units.length === 0 ? <option value="">(default)</option> : null}
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("sell.unitPrice")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="px-4 py-2 rounded border" onClick={addItem} type="button">
          {t("sell.addItem")}
        </button>

        <div className="border rounded">
          <div className="p-2 border-b text-sm font-medium">{t("sell.items")}</div>
          <div className="divide-y">
            {items.map((i, idx) => (
              <div key={idx} className="p-2 text-sm flex justify-between">
                <span>
                  Product #{i.product_id} x {i.quantity}
                </span>
                <span>{(i.quantity * i.unit_price).toFixed(2)}</span>
              </div>
            ))}
            {items.length === 0 ? <div className="p-2 text-sm">{t("sell.noItems")}</div> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm">{t("sell.payment")}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
            >
              <option value="cash">{t("sell.cash")}</option>
              <option value="momo">{t("sell.momo")}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("sell.creditSale")}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={isCredit ? "yes" : "no"}
              onChange={(e) => setIsCredit(e.target.value === "yes")}
            >
              <option value="no">{t("sell.no")}</option>
              <option value="yes">{t("sell.yes")}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("sell.customerName")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={!isCredit}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {t("sell.total")}: {total.toFixed(2)}
          </div>
          <button className="px-4 py-2 rounded bg-black text-white" onClick={submitSale} type="button">
            {t("sell.saveSale")}
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}
      </div>
    </div>
  );
}
