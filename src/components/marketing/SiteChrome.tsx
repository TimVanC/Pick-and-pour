import Link from "next/link";
import { cta, footerNav, primaryNav, site } from "@/content/site";
import { MobileMenu } from "./client";
import { ButtonLink, Wordmark } from "./ui";

export function SiteHeader() {
  return (
    <header className="bg-charcoal text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label={`${site.name} home`}>
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-base uppercase tracking-wide text-cream/80 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink
            href={cta.primary.href}
            event="header_book_demo"
            className="min-h-11 px-5 text-base"
          >
            {cta.primary.label}
          </ButtonLink>
        </nav>

        <MobileMenu />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-charcoal pb-28 text-cream md:pb-0">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-sm text-cream/60">{site.madeBy}</p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-cream/80 hover:text-gold">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-10 border-t border-cream/10 pt-6 text-sm text-cream/70">
          {site.footerLine}
        </p>
      </div>
    </footer>
  );
}
