"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cta, primaryNav } from "@/content/site";
import { ButtonLink } from "./ui";

/**
 * Sends a `cta_click` analytics event for every click on an element with a
 * `data-cta` attribute (set by ButtonLink's `event` prop). Renders nothing.
 */
export function CtaTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-cta]")
          : null;
      if (!target?.dataset.cta) return;
      track("cta_click", {
        cta: target.dataset.cta,
        page: window.location.pathname,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

/** "Book a demo" bar pinned to the bottom of the screen on phones. */
export function StickyCta() {
  const pathname = usePathname();
  // The demo page already is the form; a second button would cover its submit.
  if (pathname === cta.primary.href) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-charcoal/95 px-4 py-3 backdrop-blur md:hidden">
      <ButtonLink
        href={cta.primary.href}
        event="sticky_book_demo"
        className="w-full"
      >
        {cta.primary.label}
      </ButtonLink>
    </div>
  );
}

/** Phone navigation menu. Closes itself when a link is tapped. */
export function MobileMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={detailsRef} className="relative md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border-2 border-cream/40 px-4 font-display text-base uppercase tracking-wide [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <nav
        aria-label="Main"
        onClick={() => detailsRef.current?.removeAttribute("open")}
        className="absolute right-0 z-30 mt-2 grid w-56 gap-1 rounded-2xl bg-charcoal-700 p-2 shadow-xl"
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 items-center rounded-xl px-4 font-display text-lg uppercase tracking-wide hover:bg-charcoal-600"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
