import Link from "next/link";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "onDark" | "onLight" | "gold";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-tomato text-cream hover:bg-tomato-600",
  gold: "bg-gold text-charcoal hover:bg-gold-600",
  onDark: "border-2 border-cream/40 text-cream hover:border-cream",
  onLight: "border-2 border-charcoal/30 text-charcoal hover:border-charcoal",
};

/**
 * The site's call-to-action link. `event` names the analytics event for the click
 * (wired up with Vercel Analytics in a later step).
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  event,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  event?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-cta={event}
      className={`inline-flex min-h-14 items-center justify-center rounded-full px-7 font-display text-lg font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Visible marker for copy or images that still need a real value. */
export function PlaceholderTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-md border border-dashed border-current px-1.5 py-0.5 align-middle font-sans text-[10px] font-semibold uppercase tracking-widest ${className}`}
    >
      Placeholder
    </span>
  );
}

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-display text-sm font-semibold uppercase tracking-[0.2em] ${className}`}
    >
      {children}
    </p>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-2xl font-bold uppercase tracking-wide ${className}`}
    >
      Pick <span className="text-gold">&amp;</span> Pour
    </span>
  );
}
