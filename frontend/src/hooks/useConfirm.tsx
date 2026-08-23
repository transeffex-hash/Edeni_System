"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "use-intl";

import ConfirmDialog from "@/components/ConfirmDialog";

interface ConfirmState {
  open: boolean;
  message: string;
  onConfirm: () => void;
}

export function useConfirm() {
  const t = useTranslations();
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string, onConfirm: () => void) => {
    setState({ open: true, message, onConfirm });
  }, []);

  const close = useCallback(() => setState(null), []);

  const handleConfirm = useCallback(() => {
    const action = state?.onConfirm;
    setState(null);
    action?.();
  }, [state]);

  const Dialog = useCallback(() => {
    if (!state) return null;
    return (
      <ConfirmDialog
        isOpen={state.open}
        title={t("confirm.title")}
        message={state.message}
        confirmText={t("confirm.confirm")}
        cancelText={t("confirm.cancel")}
        isDestructive
        onConfirm={handleConfirm}
        onCancel={close}
      />
    );
  }, [state, close, handleConfirm, t]);

  return { confirm, Dialog };
}

