import type { ReactNode } from "react";
import type { FaqItem } from "@/content/faq";
import { cta } from "@/content/site";
import { ButtonLink, Eyebrow, PlaceholderTag } from "./ui";

export const h2Class =
  "font-display text-4xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl";
export const containerClass = "mx-auto max-w-6xl px-5";

/** Dark title band at the top of every page except the home page. */
export function PageHero({
  eyebrow,
  headline,
  subline,
  children,
}: {
  eyebrow: string;
  headline: string;
  subline?: string;
  children?: ReactNode;
}) {
  return (
    <section className="bg-charcoal text-cream">
      <div className={`${containerClass} pt-8 pb-14 lg:pt-14 lg:pb-20`}>
        <Eyebrow className="text-gold">{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight text-balance sm:text-7xl">
          {headline}
        </h1>
        {subline && (
          <p className="mt-6 max-w-2xl text-lg text-cream/85 sm:text-xl">
            {subline}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group rounded-2xl border-2 border-charcoal bg-cream"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-display text-xl font-semibold uppercase [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden="true"
              className="text-2xl text-tomato transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="px-5 pb-5 text-lg text-charcoal/80">
            {item.answer} {item.placeholder && <PlaceholderTag />}
          </p>
        </details>
      ))}
    </div>
  );
}

/** Closing call-to-action band. `id` prefixes the analytics event names. */
export function CtaBand({
  id,
  headline,
  body,
  showSecondary = true,
}: {
  id: string;
  headline: string;
  body: string;
  showSecondary?: boolean;
}) {
  return (
    <section className="bg-charcoal text-cream">
      <div className={`${containerClass} py-16 text-center lg:py-24`}>
        <h2 className="font-display text-5xl font-bold uppercase leading-none tracking-tight text-balance sm:text-7xl">
          {headline}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-cream/80">{body}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={cta.primary.href} event={`${id}_book_demo`}>
            {cta.primary.label}
          </ButtonLink>
          {showSecondary && (
            <ButtonLink
              href={cta.secondary.href}
              variant="onDark"
              event={`${id}_how_it_works`}
            >
              {cta.secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}

/** PLACEHOLDER IMAGE: a labelled dashed box. Swap for next/image when photos exist. */
export function PlaceholderImage({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-64 items-center justify-center rounded-3xl border-2 border-dashed border-charcoal/40 bg-cream-200 p-8 text-center ${className}`}
    >
      <p className="text-charcoal/70">
        <PlaceholderTag className="mb-2" />
        <span className="block">{label}</span>
      </p>
    </div>
  );
}
