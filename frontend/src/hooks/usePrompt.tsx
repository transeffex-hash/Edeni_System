"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "use-intl";

import PromptDialog from "@/components/PromptDialog";

interface PromptState {
  open: boolean;
  title: string;
  message: string;
  onSubmit: (value: string) => void;
}

export function usePrompt() {
  const t = useTranslations();
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");

  const prompt = useCallback((title: string, message: string, defaultValue: string, onSubmit: (value: string) => void) => {
    setState({ open: true, title, message, onSubmit });
    setValue(defaultValue);
  }, []);

  const close = useCallback(() => {
    setState(null);
    setValue("");
  }, []);

  const handleConfirm = useCallback(() => {
    const action = state?.onSubmit;
    setState(null);
    action?.(value);
  }, [state, value]);

  const Dialog = useCallback(() => {
    if (!state) return null;
    return (
      <PromptDialog
        isOpen={state.open}
        title={state.title}
        message={state.message}
        value={value}
        confirmText={t("confirm.confirm")}
        cancelText={t("confirm.cancel")}
        onChange={setValue}
        onConfirm={handleConfirm}
        onCancel={close}
      />
    );
  }, [state, value, close, handleConfirm, t]);

  return { prompt, Dialog };
}
