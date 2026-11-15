"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * Barcode scanning, two ways:
 *
 * 1. `useHardwareScanner(onScan)` — for USB/Bluetooth scanners. They behave
 *    like a keyboard: they "type" the code very fast and end with Enter.
 *    We detect that burst and call onScan with the code.
 *
 * 2. `<BarcodeScannerModal>` — opens the device camera. Uses the built-in
 *    BarcodeDetector when the browser supports it, and @zxing/browser in
 *    parallel (it decodes better). Every stage reports its status to the
 *    user — spinner, which engine is running, and real errors.
 */

const BURST_GAP_MS = 150;
const MIN_CODE_LEN = 8;

export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef("");
  const lastKeyAt = useRef(0);
  const callbackRef = useRef(onScan);
  callbackRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let burst = false;

    function onKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastKeyAt.current;
      lastKeyAt.current = now;

      if (e.key === "Enter") {
        if (burst && buffer.current.length >= MIN_CODE_LEN) {
          const code = buffer.current;
          buffer.current = "";
          burst = false;
          e.preventDefault();
          e.stopPropagation();
          callbackRef.current(code);
          return;
        }
        buffer.current = "";
        burst = false;
        return;
      }

      if (e.key.length !== 1) {
        buffer.current = "";
        burst = false;
        return;
      }

      // A hardware scanner delivers every keystroke almost instantly.
      burst = buffer.current === "" ? true : burst && gap < BURST_GAP_MS;
      buffer.current += e.key;
      if (buffer.current.length > 64) buffer.current = buffer.current.slice(-64);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

type Stage = "starting" | "scanning" | "found" | "error";

export default function BarcodeScannerModal({ onDetected, onClose }: Props) {
  const t = useTranslations("barcode");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>("starting");
  const [status, setStatus] = useState<string>("");
  const [engine, setEngine] = useState<string>("");
  const [manual, setManual] = useState("");
  const detected = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stopStream: (() => void) | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let zxingStarted = false;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function finish(code: string) {
      if (detected.current) return;
      detected.current = true;
      setStage("found");
      setStatus(code);
      // brief success flash, then hand the code back
      setTimeout(() => onDetected(code), 350);
    }

    function fail(msg: string) {
      if (!cancelled) {
        setStage("error");
        setStatus(msg);
      }
    }

    async function start() {
      setStatus(t("startingCamera"));
      if (!navigator.mediaDevices?.getUserMedia) {
        fail(t("cameraUnsupported"));
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        fail(t("cameraDenied"));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      stopStream = () => stream.getTracks().forEach((tr) => tr.stop());
      const video = videoRef.current;
      if (!video) {
        fail(t("cameraUnsupported"));
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        fail(t("cameraDenied"));
        return;
      }
      setStage("scanning");
      setStatus(t("pointAtBarcode"));

      // --- Engine 1: native BarcodeDetector (fast, when it works) ---
      const Detector = (window as any).BarcodeDetector;
      let nativeOk = false;
      if (Detector) {
        try {
          const supported: string[] = await Detector.getSupportedFormats();
          nativeOk = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"].some(
            (f) => supported.includes(f)
          );
        } catch {
          nativeOk = false;
        }
      }

      if (nativeOk) {
        setEngine("native");
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });
        const tick = async () => {
          if (cancelled || detected.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              finish(codes[0].rawValue);
              return;
            }
          } catch {
            // keep polling
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      }

      // --- Engine 2: ZXing (stronger decoder; starts immediately if the
      // native engine can't handle our formats, else in parallel after 3s) ---
      const startZxing = async () => {
        if (cancelled || zxingStarted || detected.current) return;
        zxingStarted = true;
        try {
          setStatus(nativeOk ? t("tryingStronger") : t("pointAtBarcode"));
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints);
          setEngine(nativeOk ? "native + zxing" : "zxing");

          // We grab frames ourselves onto a canvas and run the synchronous
          // decodeFromCanvas() — the one zxing call with no video/stream
          // plumbing that can silently stall.
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("canvas 2d context unavailable");

          const isNotFound = (e: any) =>
            e?.name === "NotFoundException" || /NotFound/i.test(String(e?.constructor?.name ?? e));

          // zxing's 1D reader scans horizontal rows, so a tilted barcode never
          // yields a clean line. Real phones are almost never perfectly level,
          // so every frame is tried as-is, then rotated, then contrast-boosted.
          const tryDecode = (angleDeg: number, boost: boolean, cropCenter: boolean): string | null => {
            const srcW = video.videoWidth;
            const srcH = video.videoHeight;
            // Crop to the band around the red guide line: less background for
            // the decoder to wade through and the bars fill more of the image.
            const sx = cropCenter ? Math.round(srcW * 0.1) : 0;
            const sy = cropCenter ? Math.round(srcH * 0.3) : 0;
            const sw = cropCenter ? Math.round(srcW * 0.8) : srcW;
            const sh = cropCenter ? Math.round(srcH * 0.4) : srcH;
            // Upscale small crops so bars are several pixels wide.
            const target = cropCenter ? 1000 : 800;
            const scale = Math.min(2, target / sw);
            const vw = Math.round(sw * scale);
            const vh = Math.round(sh * scale);
            canvas.width = vw;
            canvas.height = vh;
            ctx.save();
            ctx.filter = boost ? "contrast(1.8) brightness(1.3) grayscale(1)" : "none";
            if (angleDeg !== 0) {
              ctx.translate(vw / 2, vh / 2);
              ctx.rotate((angleDeg * Math.PI) / 180);
              ctx.translate(-vw / 2, -vh / 2);
            }
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
            ctx.restore();
            try {
              const res = reader.decodeFromCanvas(canvas);
              return res ? res.getText() : null;
            } catch (e: any) {
              if (isNotFound(e)) return null;
              throw e;
            }
          };

          // Attempt order: cheap first. One variant per tick keeps the UI smooth.
          const variants: [number, boolean, boolean][] = [
            [0, false, true], [0, false, false],
            [0, true, true],
            [-12, false, true], [12, false, true],
            [-25, false, true], [25, false, true],
            [-12, true, true], [12, true, true],
            [90, false, false], [-40, false, true], [40, false, true],
          ];
          let vi = 0;
          let consecutiveErrors = 0;

          const poll = () => {
            if (cancelled || detected.current) return;
            if (video.readyState >= 2 && video.videoWidth > 0) {
              const [angle, boost, crop] = variants[vi];
              vi = (vi + 1) % variants.length;
              try {
                const text = tryDecode(angle, boost, crop);
                if (text) {
                  finish(text);
                  return;
                }
                consecutiveErrors = 0;
              } catch (e) {
                consecutiveErrors += 1;
                console.error("zxing decode error:", e);
                if (consecutiveErrors > 20) {
                  fail(t("engineFailed"));
                  return;
                }
              }
            }
            timers.push(setTimeout(poll, 60));
          };
          poll();
          zxingControls = { stop: () => {} };
        } catch (e) {
          console.error("zxing failed to start:", e);
          setEngine(nativeOk ? "native (zxing unavailable)" : "zxing");
          if (!nativeOk) fail(t("engineFailed"));
        }
      };

      timers.push(setTimeout(startZxing, nativeOk ? 3000 : 0));
      // after 12s with nothing, nudge the user
      timers.push(
        setTimeout(() => {
          if (!detected.current && !cancelled) setStatus(t("stillScanning"));
        }, 12000)
      );
    }

    start();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      zxingControls?.stop();
      stopStream?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("scanTitle")}</h2>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose} type="button">×</button>
        </div>
        <div className="p-4 space-y-3">
          {stage === "starting" && (
            <div className="rounded-xl bg-gray-50 aspect-[4/3] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[#0a7e6b] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">{status}</p>
            </div>
          )}

          {/* The video element is mounted exactly once and never unmounted —
              swapping it for another element would lose the camera stream. */}
          <div className={`relative rounded-xl overflow-hidden bg-black aspect-[4/3] ${stage === "scanning" || stage === "found" ? "" : "hidden"}`}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.8)] pointer-events-none" />
            <div className="absolute inset-0 border-2 border-[#0a7e6b]/60 rounded-xl pointer-events-none" />
            {stage === "found" && (
              <div className="absolute inset-0 bg-[#0a7e6b]/70 flex items-center justify-center">
                <span className="text-white font-bold text-lg">✓ {status}</span>
              </div>
            )}
          </div>

          {stage === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{status}</p>
          )}

          {(stage === "scanning" || stage === "found") && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{status}</span>
              {engine ? (
                <span className="text-[10px] uppercase tracking-wide text-gray-300 font-mono">
                  {engine}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="app-input flex-1"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) {
                  detected.current = true;
                  onDetected(manual.trim());
                }
              }}
              placeholder={t("manualPlaceholder")}
            />
            <button
              className="app-btn-outline"
              type="button"
              onClick={() => {
                if (manual.trim()) {
                  detected.current = true;
                  onDetected(manual.trim());
                }
              }}
            >
              {t("use")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
