"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { apiGet, apiPost } from "@/lib/api";

type Entry = {
  id: number;
  ledger_type: "customer" | "supplier";
  party_name: string;
  amount: number;
  note: string | null;
};

export default function PartyLedgerPage() {
  const router = useRouter();
  const params = useParams<{ type: string; party: string }>();
  const type = params.type as "customer" | "supplier";
  const party = decodeURIComponent(params.party);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await apiGet<Entry[]>(
        `/api/ledger/entries?ledger_type=${type}&party_name=${encodeURIComponent(party)}`
      );
      setEntries(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load entries");
    }
  }

  useEffect(() => {
    load();
  }, [type, party]);

  const balance = entries.reduce((s, e) => s + e.amount, 0);

  async function addEntry(sign: "credit" | "payment") {
    setError(null);

    const normalizedAmount = sign === "payment" ? -Math.abs(amount) : Math.abs(amount);

    try {
      await apiPost<Entry>("/api/ledger/entries", {
        ledger_type: type,
        party_name: party,
        amount: normalizedAmount,
        note: note || null
      });
      setAmount(0);
      setNote("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">{type.toUpperCase()}</div>
          <h1 className="text-xl font-semibold">{party}</h1>
        </div>
        <button className="px-3 py-2 border rounded" onClick={() => router.back()} type="button">
          Back
        </button>
      </div>

      <div className="border rounded p-3 flex items-center justify-between">
        <div className="font-medium">Balance</div>
        <div className="text-sm">{balance.toFixed(2)}</div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="border rounded p-4 space-y-3">
        <div className="font-medium">Quick actions</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm">Amount</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm">Note (optional)</label>
            <input className="w-full border rounded px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={() => addEntry("credit")} type="button">
            Add credit
          </button>
          <button className="px-4 py-2 rounded border" onClick={() => addEntry("payment")} type="button">
            Record payment
          </button>
        </div>
      </div>

      <div className="border rounded">
        <div className="p-3 border-b font-medium">Entries</div>
        <div className="divide-y">
          {entries.map((e) => (
            <div key={e.id} className="p-3 text-sm flex justify-between">
              <div>
                <div className="font-medium">{e.amount.toFixed(2)}</div>
                <div className="text-gray-600">{e.note ?? ""}</div>
              </div>
              <div className="text-gray-600">#{e.id}</div>
            </div>
          ))}
          {entries.length === 0 ? <div className="p-3 text-sm">No entries</div> : null}
        </div>
      </div>
    </div>
  );
}
