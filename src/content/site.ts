/**
 * Site-wide copy and navigation. Edit copy here, not in components.
 * Anything marked PLACEHOLDER still needs a real value before launch.
 */

/**
 * Public address of the site, used for canonical links, the sitemap and the OG image.
 * 1. NEXT_PUBLIC_SITE_URL if set (use this for a custom domain).
 * 2. Otherwise the project's production domain on Vercel (set by Vercel at build time).
 * 3. Otherwise a PLACEHOLDER.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://pickandpour.example");

export const site = {
  name: "Pick & Pour",
  tagline: "Turn slow Sundays into game day",
  description:
    "Pick & Pour turns game days at your bar into a live game: guests pick a side, and if their team wins, their tab drops. Free for guests, never above menu price.",
  url: siteUrl,
  footerLine:
    "Free for guests. Never above menu price. Subject to local liquor rules.",
  madeBy: "Made in New Jersey by VanHaus",
} as const;

export type NavItem = { label: string; href: string };

export const primaryNav: NavItem[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export const footerNav: NavItem[] = [
  ...primaryNav,
  { label: "Book a demo", href: "/demo" },
  { label: "House rules", href: "/house-rules" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export const cta = {
  primary: { label: "Book a demo", href: "/demo" },
  secondary: { label: "See how it works", href: "/how-it-works" },
  founding: { label: "Claim a founding spot", href: "/demo" },
} as const;
