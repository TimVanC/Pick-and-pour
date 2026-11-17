/**
 * Legal pages. ALL PLACEHOLDER TEXT: none of this has been reviewed by a lawyer.
 * Replace before launch.
 */

export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDoc = {
  title: string;
  description: string;
  updated: string;
  sections: LegalSection[];
};

export const legalNotice =
  "Placeholder text. This page has not been reviewed by a lawyer and is not final.";

export const terms: LegalDoc = {
  title: "Terms of Service",
  description: "Placeholder terms of service for Pick & Pour.",
  updated: "[Date]",
  sections: [
    {
      heading: "1. The service",
      paragraphs: [
        "[Placeholder.] Pick & Pour provides software that lets a licensed venue run a free promotional game in which a guest's tab discount depends on the result of a featured game.",
      ],
    },
    {
      heading: "2. Venue responsibilities",
      paragraphs: [
        "[Placeholder.] The venue is responsible for complying with its liquor licence and local promotion rules, for the settings it chooses, and for applying discounts in its point-of-sale system.",
      ],
    },
    {
      heading: "3. Plans and billing",
      paragraphs: [
        "[Placeholder.] Plans are billed monthly or yearly as described on the pricing page. Founding-bar terms are set out in the founding offer.",
      ],
    },
    {
      heading: "4. No wagering",
      paragraphs: [
        "[Placeholder.] The game is free to play. Guests never pay an entry fee and never pay more than menu price.",
      ],
    },
    {
      heading: "5. Contact",
      paragraphs: ["[Placeholder.] Questions about these terms: [contact email]."],
    },
  ],
};

export const privacy: LegalDoc = {
  title: "Privacy Policy",
  description: "Placeholder privacy policy for Pick & Pour.",
  updated: "[Date]",
  sections: [
    {
      heading: "1. What we collect",
      paragraphs: [
        "[Placeholder.] From bars that request a demo: name, bar name, city and state, role, phone, email and the notes you send us.",
        "[Placeholder.] From guests who opt in at a venue: first name and a phone number or email, with explicit consent, stored for that venue.",
      ],
    },
    {
      heading: "2. How we use it",
      paragraphs: [
        "[Placeholder.] To set up demos, run the service, and send the messages you asked for. We do not sell personal information.",
      ],
    },
    {
      heading: "3. Analytics",
      paragraphs: [
        "[Placeholder.] This site uses privacy-friendly analytics to count page views and button clicks.",
      ],
    },
    {
      heading: "4. Your choices",
      paragraphs: [
        "[Placeholder.] You can ask us to delete your information at any time: [contact email].",
      ],
    },
  ],
};

/** House rules template per jurisdiction, mirroring the PRD's jurisdiction profiles. */
export type HouseRulesProfile = {
  code: "NJ" | "NY";
  name: string;
  /** Maximum discount as a whole percent. */
  maxDiscountPercent: number;
  status: string;
  rules: string[];
};

const sharedRules = [
  "Free to play. No purchase is needed to see the board.",
  "You never pay more than menu price.",
  "One pick per tab at a time. A tab cannot hold both sides of the same game.",
  "Lock-ins are offered at breaks only and are final.",
  "A tie settles at full price. A postponed or cancelled game voids its picks.",
  "The discount applies to up to $[max covered spend] of your tab, before tax.",
  "Management may void a pick. Please enjoy responsibly.",
];

export const houseRules: {
  title: string;
  description: string;
  intro: string;
  profiles: HouseRulesProfile[];
} = {
  title: "House Rules",
  description:
    "House rules template for venues running Pick & Pour, by state.",
  intro:
    "Every venue shows its own house rules on the guest page and table card. These are the templates, by state.",
  profiles: [
    {
      code: "NJ",
      name: "New Jersey",
      maxDiscountPercent: 65,
      status: "Pending legal review",
      rules: ["Maximum discount 65% under New Jersey rules.", ...sharedRules],
    },
    {
      code: "NY",
      name: "New York",
      maxDiscountPercent: 50,
      status: "Not yet available. Pending legal review",
      rules: ["Maximum discount 50% under New York rules.", ...sharedRules],
    },
  ],
};
