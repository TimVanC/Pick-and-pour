"use client";

import QRCode from "qrcode";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Fetch a JSON endpoint now and then every `intervalMs`, so screens update
 * without a refresh. `failedSince` is when polling started failing (null while
 * healthy), which lets a screen say "Reconnecting" instead of showing stale numbers.
 */
export function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [failedSince, setFailedSince] = useState<number | null>(null);
  // Bumping this restarts the polling loop, which fetches straight away.
  const [restart, setRestart] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!alive) return;
        setStatus(response.status);
        if (response.ok) {
          const json = (await response.json()) as T;
          if (!alive) return;
          setData(json);
          setFailedSince(null);
        } else if (response.status >= 500) {
          setFailedSince((since) => since ?? Date.now());
        }
      } catch {
        if (alive) setFailedSince((since) => since ?? Date.now());
      } finally {
        inFlight.current = false;
      }
    };
    load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      inFlight.current = false;
      window.clearInterval(timer);
    };
  }, [url, intervalMs, restart]);

  const refresh = useCallback(() => setRestart((count) => count + 1), []);
  return { data, status, failedSince, refresh };
}

/** POST JSON and return the reply. Throws an Error with a message the user can read. */
export async function post<T = { ok: true }>(url: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("No connection. Check the network and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

/** Run an action with a busy flag and a readable error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clearError: () => setError(null) };
}

type ButtonVariant = "primary" | "gold" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-tomato text-cream active:bg-tomato-600",
  gold: "bg-gold text-charcoal active:bg-gold-600",
  ghost: "border-2 border-cream/30 text-cream active:bg-charcoal-700",
  danger: "border-2 border-tomato text-cream active:bg-tomato",
};

/** Big touch target (56px) for one-handed use behind a bar. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-14 items-center justify-center rounded-2xl px-5 font-display text-lg font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl border-2 border-tomato bg-tomato/15 px-4 py-3 text-cream">
      {children}
    </p>
  );
}

export const fieldClass =
  "mt-2 min-h-14 w-full rounded-2xl border-2 border-cream/30 bg-charcoal-800 px-4 text-lg text-cream placeholder:text-cream/40 focus-visible:border-gold focus-visible:outline-none";
export const labelClass =
  "block font-display text-base font-semibold uppercase tracking-wide text-cream/80";

/** A QR code for a link, drawn as SVG. */
export function Qr({ value, className = "" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let current = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((markup) => {
        if (current) setSvg(markup);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label="QR code"
      className={`overflow-hidden rounded-xl bg-white p-1 [&>svg]:block [&>svg]:size-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** This site's address (https://...), or an empty string while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

/** "62%" from 0.62. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Parse what someone typed into a dollar field into cents. */
export function dollarsToCents(text: string): number {
  const value = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
