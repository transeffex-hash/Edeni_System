"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

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

type ProductSearchProps = {
  value: ProductWithStock | null;
  onSelect: (product: ProductWithStock | null) => void;
  placeholder?: string;
};

export default function ProductSearch({
  value,
  onSelect,
  placeholder = "Search product...",
}: ProductSearchProps) {
  const t = useTranslations();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    if (value && query === value.name) {
      setProducts([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("search", q);
        params.set("limit", "20");
        const data = await apiGet<ProductWithStock[]>(
          `/api/inventory/products/with-stock?${params.toString()}`
        );
        setProducts(data);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [products]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(product: ProductWithStock) {
    onSelect(product);
    setQuery(product.name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, products.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (products[highlightedIndex]) handleSelect(products[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="app-input w-full"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSelect(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg px-3 py-2 text-sm text-gray-400">
          {t("dashboard.loading")}
        </div>
      ) : open && products.length > 0 ? (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg">
          {products.map((p, idx) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(p);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2.5 text-sm cursor-pointer transition-colors border-b border-black/5 last:border-0 ${
                idx === highlightedIndex
                  ? "bg-[#0a7e6b]/10 text-[#0a7e6b]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{p.name}</div>
                  {p.sku ? (
                    <div className="text-xs text-gray-500">{p.sku}</div>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-[#0a7e6b]">
                    {p.total_stock} {p.unit}
                  </div>
                  <div className="text-[10px] text-gray-400">{t("products.inStock")}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : open && query.length >= 1 && !loading ? (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg">
          <li className="px-3 py-2 text-sm text-gray-400">{t("products.noProducts")}</li>
        </ul>
      ) : null}
    </div>
  );
}
