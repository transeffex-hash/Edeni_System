"use client";

import { useEffect, useRef } from "react";

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  value: string;
  type?: string;
  confirmText?: string;
  cancelText?: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PromptDialog({
  isOpen,
  title,
  message,
  value,
  type = "text",
  confirmText = "OK",
  cancelText = "Cancel",
  onChange,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel, onConfirm]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="app-card w-full max-w-sm p-5 space-y-4 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{message}</p>
        </div>

        <input
          ref={inputRef}
          type={type}
          className="app-input w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="app-btn-ghost">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className="app-btn-primary">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
