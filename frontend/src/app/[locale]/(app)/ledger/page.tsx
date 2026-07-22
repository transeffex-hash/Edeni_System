"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { apiGet } from "@/lib/api";

type Balance = { party_name: string; balance: number };

export default function LedgerHomePage() {
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [rows, setRows] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const data = await apiGet<Balance[]>(`/api/ledger/balances?ledger_type=${type}`);
        setRows(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      }
    })();
  }, [type]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ledgers</h1>
        <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
        </select>
      </div>

      <div className="text-sm text-gray-600">
        Continuous ledger: positive is debt, negative is payment.
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="border rounded divide-y">
        {rows.map((r) => (
          <Link
            key={r.party_name}
            className="block p-3 hover:bg-gray-50"
            href={`/ledger/${type}/${encodeURIComponent(r.party_name)}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.party_name}</div>
              <div className="text-sm">{r.balance.toFixed(2)}</div>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? <div className="p-3 text-sm">No ledger entries</div> : null}
      </div>

      <div className="border rounded p-3">
        <div className="font-medium">Quick actions</div>
        <div className="mt-2 text-sm text-gray-600">
          Open a party to add credit or record a payment.
        </div>
      </div>
    </div>
  );
}
