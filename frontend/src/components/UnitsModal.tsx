"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet, apiPatch, apiPost } from "@/lib/api";
import BarcodeScannerModal from "@/components/BarcodeScanner";

export type ProductUnit = {
  id: number;
  product_id: number;
  name: string;
  factor_to_base: number;
  is_base: boolean;
  selling_price: number | null;
  barcode: string | null;
};

type Props = {
  product: { id: number; name: string; unit: string; barcode: string | null };
  onClose: () => void;
};

/**
 * Manage a product's units (piece, carton, box...) and the barcode for each.
 * A hardware scanner just needs the barcode field focused; the camera button
 * opens BarcodeScannerModal.
 */
export default function UnitsModal({ product, onClose }: Props) {
  const t = useTranslations();
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [productBarcode, setProductBarcode] = useState(product.barcode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanTarget, setScanTarget] = useState<"product" | number | "new" | null>(null);

  // new unit form
  const [nName, setNName] = useState("");
  const [nFactor, setNFactor] = useState("");
  const [nPrice, setNPrice] = useState("");
  const [nBarcode, setNBarcode] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiGet<ProductUnit[]>(`/api/inventory/products/${product.id}/units`);
      setUnits(data);
    } catch {
      setUnits([]);
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProductBarcode() {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/inventory/products/${product.id}`, {
        barcode: productBarcode.trim() || "",
      });
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToSave"));
    } finally {
      setBusy(false);
    }
  }

  async function saveUnit(u: ProductUnit, patch: { selling_price?: number | null; barcode?: string }) {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/inventory/products/${product.id}/units/${u.id}`, patch);
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToSave"));
    } finally {
      setBusy(false);
    }
  }

  async function addUnit() {
    const factor = Number(nFactor);
    if (!nName.trim()) {
      setError(`${t("units.name")} ${t("errors.required")}`);
      return;
    }
    if (!nFactor || isNaN(factor) || factor <= 0) {
      setError(`${t("units.factor")} ${t("errors.required")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/inventory/products/${product.id}/units`, {
        name: nName.trim(),
        factor_to_base: Math.trunc(factor),
        is_base: units.length === 0,
        selling_price: nPrice ? Number(nPrice) : null,
        barcode: nBarcode.trim() || null,
      });
      setNName("");
      setNFactor("");
      setNPrice("");
      setNBarcode("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("errors.failedToSave"));
    } finally {
      setBusy(false);
    }
  }

  function onScanned(code: string) {
    if (scanTarget === "product") setProductBarcode(code);
    else if (scanTarget === "new") setNBarcode(code);
    else if (typeof scanTarget === "number") {
      setUnits((prev) => prev.map((u) => (u.id === scanTarget ? { ...u, barcode: code } : u)));
    }
    setScanTarget(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("units.title", { name: product.name })}</h2>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose} type="button">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Product-level barcode */}
          <div className="space-y-1.5">
            <label className="app-label">{t("units.productBarcode")}</label>
            <div className="flex gap-2">
              <input
                className="app-input flex-1"
                value={productBarcode}
                onChange={(e) => setProductBarcode(e.target.value)}
                placeholder={t("units.barcodePlaceholder")}
              />
              <button className="app-btn-outline" onClick={() => setScanTarget("product")} type="button" title={t("barcode.scanTitle")}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" />
                </svg>
              </button>
              <button className="app-btn-primary" onClick={saveProductBarcode} disabled={busy} type="button">
                {t("units.save")}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t("units.productBarcodeHint")}</p>
          </div>

          {/* Existing units */}
          <div className="rounded-xl border border-black/5 overflow-hidden">
            <div className="p-3 border-b border-black/5 text-sm font-semibold text-gray-700 bg-[#f6f7f8]">
              {t("units.existing")}
            </div>
            {units.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">{t("units.none")}</div>
            ) : (
              units.map((u) => (
                <div key={u.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 border-b border-black/5 last:border-0 text-sm">
                  <div className="col-span-3">
                    <span className="font-medium text-gray-800">{u.name}</span>
                    {u.is_base ? <span className="ml-1.5 text-[10px] text-[#0a7e6b] font-semibold uppercase">{t("units.base")}</span> : null}
                    <div className="text-[11px] text-gray-400">×{u.factor_to_base} {product.unit}</div>
                  </div>
                  <div className="col-span-2">
                    <input
                      className="app-input !py-1 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={u.selling_price ?? ""}
                      placeholder={t("units.price")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.target as HTMLInputElement).value;
                          saveUnit(u, { selling_price: v ? Number(v) : null });
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value;
                        const next = v ? Number(v) : null;
                        if (next !== u.selling_price) saveUnit(u, { selling_price: next });
                      }}
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      className="app-input !py-1 text-sm font-mono"
                      value={u.barcode ?? ""}
                      placeholder={t("units.barcodePlaceholder")}
                      onChange={(e) =>
                        setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, barcode: e.target.value } : x)))
                      }
                      onKeyDown={(e) => e.key === "Enter" && saveUnit(u, { barcode: u.barcode ?? "" })}
                    />
                  </div>
                  <div className="col-span-2 flex gap-1 justify-end">
                    <button className="app-btn-ghost !p-1.5" onClick={() => setScanTarget(u.id)} type="button" title={t("barcode.scanTitle")}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button className="app-btn-primary !py-1 !px-2.5 text-xs" onClick={() => saveUnit(u, { barcode: u.barcode ?? "" })} disabled={busy} type="button">
                      {t("units.save")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add unit */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">{t("units.add")}</div>
            <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
              <input className="app-input md:col-span-3" placeholder={t("units.namePlaceholder")} value={nName} onChange={(e) => setNName(e.target.value)} />
              <input className="app-input md:col-span-2" type="number" min={1} step={1} placeholder={t("units.factorPlaceholder", { unit: product.unit })} value={nFactor} onChange={(e) => setNFactor(e.target.value)} />
              <input className="app-input md:col-span-2" type="number" min={0} step="0.01" placeholder={t("units.price")} value={nPrice} onChange={(e) => setNPrice(e.target.value)} />
              <div className="flex gap-1 md:col-span-4">
                <input className="app-input flex-1 font-mono" placeholder={t("units.barcodePlaceholder")} value={nBarcode} onChange={(e) => setNBarcode(e.target.value)} />
                <button className="app-btn-ghost !p-1.5" onClick={() => setScanTarget("new")} type="button" title={t("barcode.scanTitle")}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <button className="app-btn-primary md:col-span-1" onClick={addUnit} disabled={busy} type="button">+</button>
            </div>
            <p className="text-xs text-gray-400">{t("units.factorHint")}</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      {scanTarget !== null && (
        <BarcodeScannerModal onDetected={onScanned} onClose={() => setScanTarget(null)} />
      )}
    </div>
  );
}
