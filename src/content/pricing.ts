/** /pricing copy and plan data. PLACEHOLDER COPY until reviewed. */

export const pricingPage = {
  eyebrow: "Pricing",
  headline: "Costs less than one good Sunday.",
  subline:
    "Simple monthly plans by sport. Pay only while the season runs. No hardware, no setup fee.",
};

export type Plan = {
  id: string;
  name: string;
  /** Monthly price in dollars. */
  monthly: number;
  priceNote: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export const plans: Plan[] = [
  {
    id: "single",
    name: "Single sport",
    monthly: 99,
    priceNote: "per month, while the season runs",
    description: "One sport, every game day.",
    features: [
      "One sport of your choice",
      "Bartender screen, TV board and guest page",
      "Your limits and house rules",
      "Game-day reports",
    ],
  },
  {
    id: "combo",
    name: "Two-sport combo",
    monthly: 149,
    priceNote: "per month",
    description: "Cover fall and winter.",
    features: [
      "Any two sports",
      "Everything in Single sport",
      "Guest opt-ins for next game day",
    ],
    highlighted: true,
  },
  {
    id: "all",
    name: "All sports",
    monthly: 179,
    priceNote: "per month, or $1,799 per year",
    description: "A game on the board all year.",
    features: [
      "Every supported sport",
      "Everything in the combo",
      "Save about two months with the yearly plan",
    ],
  },
];

export const foundingPlan = {
  name: "Founding bars",
  price: "Free",
  priceNote: "for your first season",
  body: "The first 10 bars play free for their first season and help shape what we build next.",
};

export const calculator = {
  eyebrow: "Do the math",
  headline: "What's one good Sunday worth?",
  body: "Move the sliders. This is the extra bar revenue from guests who would not have been there, before any discounts you give.",
  guests: { label: "Extra guests per game day", min: 1, max: 40, default: 8 },
  tab: { label: "Average tab", min: 10, max: 120, step: 5, default: 45 },
  gameDaysPerMonth: 4,
  planLabel: "Plan",
  footnote:
    "Illustration only, not a promise of results. Assumes 4 game days a month.",
};

export const pricingFaq = [
  {
    question: "Is there a contract?",
    answer: "No. Plans are month to month and you can stop when the season ends.",
    placeholder: true,
  },
  {
    question: "What does “while the season runs” mean?",
    answer:
      "A single-sport plan bills only during that sport's season. No games, no bill.",
    placeholder: true,
  },
  {
    question: "Are the discounts I give included in the price?",
    answer:
      "No. The plan covers the software. The discounts are yours to give, and you control them with your scale and cap.",
    placeholder: false,
  },
  {
    question: "How do I get a founding spot?",
    answer:
      "Book a demo and mention it. Founding spots go to the first 10 bars, free for their first season.",
    placeholder: true,
  },
];
