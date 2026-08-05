"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet, apiPost } from "@/lib/api";

type StockBatchCreate = {
  product_id: number;
  quantity: number;
  unit?: string | null;
  cost_price: number;
  expiry_date?: string | null;
};

type ProductUnit = { id: number; product_id: number; name: string; factor_to_base: number; is_base: boolean };

export default function AddStockPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);

  const [quantity, setQuantity] = useState(1);
  const [costPrice, setCostPrice] = useState(0);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unit, setUnit] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    })();
  }, [productId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: StockBatchCreate = {
      product_id: productId,
      quantity,
      unit: unit ? unit : null,
      cost_price: costPrice,
      expiry_date: expiryDate ? expiryDate : null
    };

    try {
      await apiPost("/api/inventory/stock", payload);
      router.push("/products");
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToAddStock"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("stock.title")}</h1>

      <form className="border rounded p-4 space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm">{t("stock.quantity")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              min={0.001}
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("labels.unit")}</label>
            <select
              className="w-full border rounded px-3 py-2"
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

          <div className="space-y-1">
            <label className="text-sm">{t("stock.costPrice")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              min={0}
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("stock.expiryDateOptional")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? t("stock.saving") : t("stock.save")}
        </button>
      </form>
    </div>
  );
}
