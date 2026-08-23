"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AutocompleteItem = {
  value: string | number;
  label: string;
};

type AutocompleteSearchProps = {
  items: AutocompleteItem[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function AutocompleteSearch({
  items,
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  disabled = false,
}: AutocompleteSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.value === value) ?? null,
    [items, value]
  );

  useEffect(() => {
    if (selectedItem) {
      setQuery(selectedItem.label);
    } else {
      setQuery("");
    }
  }, [selectedItem]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (selectedItem) setQuery(selectedItem.label);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedItem]);

  function handleSelect(item: AutocompleteItem) {
    onChange(item.value);
    setQuery(item.label);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIndex]) handleSelect(filtered[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      if (selectedItem) setQuery(selectedItem.label);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        className="app-input w-full"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg">
          {filtered.map((item, idx) => (
            <li
              key={item.value}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                idx === highlightedIndex ? "bg-[#0a7e6b]/10 text-[#0a7e6b]" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg">
          <li className="px-3 py-2 text-sm text-gray-400">No results found</li>
        </ul>
      )}
    </div>
  );
}
