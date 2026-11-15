"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { apiPost } from "@/lib/api";

type ShareData = {
  sale_id: number;
  receipt_url: string;
  business_name: string;
  total_amount: number;
  customer_name: string | null;
  items: { name: string; quantity: number; unit: string; line_total: number }[];
};

type Props = {
  saleId: number;
  defaultPhone?: string | null;
  onClose: () => void;
};

/**
 * Normalise a Rwandan phone number for wa.me (digits only, country code, no "+").
 * Accepts: 0781234567, 781234567, +250781234567, 250 781 234 567
 */
export function normalizePhoneForWhatsApp(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = "250" + digits.slice(1);
  else if (digits.length === 9) digits = "250" + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
}

export default function WhatsAppReceiptModal({ saleId, defaultPhone, onClose }: Props) {
  const t = useTranslations("whatsapp");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhone(defaultPhone ?? "");
  }, [defaultPhone]);

  const normalized = normalizePhoneForWhatsApp(phone);

  function buildMessage(d: ShareData): string {
    const lines = d.items.map((i) => `• ${fmtQty(i.quantity)} ${i.unit} ${i.name} — ${i.line_total.toLocaleString()} RWF`);
    return [
      `*${d.business_name}*`,
      t("msgGreeting", { name: d.customer_name ? ` ${d.customer_name}` : "" }),
      "",
      t("msgReceipt", { id: d.sale_id }),
      ...lines,
      "",
      `*${t("msgTotal")}: ${d.total_amount.toLocaleString()} RWF*`,
      "",
      t("msgLink"),
      d.receipt_url,
      "",
      t("msgThanks"),
    ].join("\n");
  }

  async function send() {
    if (!normalized) {
      setError(t("invalidPhone"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const data = await apiPost<ShareData>(`/api/sales/${saleId}/share`, { phone: phone.trim() });
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(buildMessage(data))}`;
      window.open(url, "_blank", "noopener,noreferrer");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? t("failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.86.5 3.61 1.38 5.12L2 22l4.95-1.37C8.51 21.3 10.21 21.8 12 21.8c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.95 14.2c-.19.54-1.08 1.01-1.49 1.06-.42.05-.86.19-2.88-.6-2.42-1-3.97-3.57-4.09-3.73-.12-.16-.98-1.3-.98-2.48s.61-1.76.84-2c.23-.25.49-.28.65-.28.16 0 .32 0 .46.01.14.01.33-.05.52.4.19.45.66 1.57.72 1.69.06.12.01.27-.02.37-.04.1-.08.22-.19.34-.1.12-.22.25-.32.34-.1.09-.21.19-.09.41.12.22.55.9 1.17 1.46.8.72 1.47.95 1.82 1.05.26.08.48-.03.55-.14.08-.1.31-.37.39-.5.08-.13.16-.11.27-.06.1.05 1.62.76 1.9.9.28.14.47.21.54.33.06.12.04.28-.02.4z" />
              </svg>
            </span>
            <h2 className="font-semibold text-gray-800">{t("title")}</h2>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose} type="button">×</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{t("hint", { id: saleId })}</p>

          <div className="space-y-1.5">
            <label className="app-label">{t("phone")}</label>
            <input
              className="app-input"
              type="tel"
              inputMode="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="078 123 4567"
            />
            {phone && !normalized ? (
              <p className="text-xs text-red-600">{t("invalidPhone")}</p>
            ) : normalized ? (
              <p className="text-xs text-gray-400">+{normalized}</p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={send}
            disabled={sending || !normalized}
            className="w-full py-3 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {sending ? t("opening") : t("send")}
          </button>
          <p className="text-[11px] text-gray-400 text-center">{t("note")}</p>
        </div>
      </div>
    </div>
  );
}
