/**
 * Site-wide copy and navigation. Edit copy here, not in components.
 * Anything marked PLACEHOLDER still needs a real value before launch.
 */

export const site = {
  name: "Pick & Pour",
  tagline: "Turn slow Sundays into game day",
  description:
    "Pick & Pour turns game days at your bar into a live game: guests pick a side, and if their team wins, their tab drops. Free for guests, never above menu price.",
  /** Set NEXT_PUBLIC_SITE_URL to the production domain. The fallback is a PLACEHOLDER. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://pickandpour.example",
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
