"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet, apiPost } from "@/lib/api";

type Product = { id: number; name: string; sku: string | null; unit: string };

type CreateProduct = { name: string; sku?: string | null; unit?: string };

export default function ProductsPage() {
  const t = useTranslations();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unit");
  const [sku, setSku] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await apiGet<Product[]>("/api/inventory/products");
      setProducts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: CreateProduct = {
      name,
      unit,
      sku: sku ? sku : null
    };

    try {
      await apiPost<Product>("/api/inventory/products", payload);
      setName("");
      setSku("");
      setUnit("unit");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create product");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("products.title")}</h1>

      <form onSubmit={onCreate} className="border rounded p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm">{t("products.name")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("products.unit")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">{t("products.skuOptional")}</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button className="px-4 py-2 rounded bg-black text-white" type="submit">
          {t("products.addProduct")}
        </button>
      </form>

      <div className="border rounded">
        <div className="p-3 border-b font-medium">{t("products.list")}</div>
        <div className="divide-y">
          {products.map((p) => (
            <div key={p.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-600">Unit: {p.unit}</div>
              </div>
              <a className="text-sm underline" href={`/products/${p.id}/stock`}>
                {t("products.addStock")}
              </a>
            </div>
          ))}
          {products.length === 0 ? (
            <div className="p-3 text-sm">{t("products.noProducts")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
