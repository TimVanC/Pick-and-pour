/**
 * FAQ copy, shared by the home page (featured items) and /faq (all items).
 * PLACEHOLDER COPY. The legal answers must be reviewed by counsel before launch.
 */

export type FaqItem = {
  question: string;
  answer: string;
  /** Shows a visible "Placeholder" tag next to the answer. */
  placeholder: boolean;
  /** Featured items also appear on the home page. */
  featured?: boolean;
};

export type FaqGroup = { title: string; items: FaqItem[] };

export const faqGroups: FaqGroup[] = [
  {
    title: "The big ones",
    items: [
      {
        question: "Is it gambling?",
        answer:
          "Guests never pay to play and never pay more than menu price. It works like a promotion you control: a discount that depends on the game. [Placeholder: final wording pending legal review.]",
        placeholder: true,
        featured: true,
      },
      {
        question: "Is it legal in my state?",
        answer:
          "Liquor promotion rules vary by state. Pick & Pour ships with a rules profile per state that sets the limits for you. [Placeholder: list of supported states pending legal review.]",
        placeholder: true,
        featured: true,
      },
      {
        question: "What does it cost me per night?",
        answer:
          "You set a scale and a cap, so the average discount lands where you want it, in the range of a happy hour. Losing picks pay full price.",
        placeholder: true,
        featured: true,
      },
    ],
  },
  {
    title: "Setup",
    items: [
      {
        question: "Do I need new hardware?",
        answer:
          "No. The bartender screen runs in the browser on a tablet or phone, and the board runs on any smart TV or streaming stick.",
        placeholder: false,
        featured: true,
      },
      {
        question: "Does it work with my POS?",
        answer:
          "Yes. Orders stay in your POS and the bartender applies the discount with your existing discount button. A direct Toast integration is on the roadmap.",
        placeholder: false,
        featured: true,
      },
      {
        question: "How long does setup take?",
        answer:
          "About 30 minutes: pick your settings, open the board on your TV, and walk your bartenders through the three-tap flow.",
        placeholder: true,
      },
      {
        question: "Which sports can I run?",
        answer:
          "Pro football first. Basketball, hockey, baseball and college games are next. Any two-sided game works.",
        placeholder: true,
      },
    ],
  },
  {
    title: "On game day",
    items: [
      {
        question: "What is a lock-in?",
        answer:
          "At a quarter break or halftime, a guest whose side is doing better than at kickoff can lock in a smaller discount right then. If the line has moved against them, there is nothing to lock in and the pick stays live.",
        placeholder: false,
      },
      {
        question: "What happens if a guest's team loses?",
        answer:
          "They pay menu price, the same as any other night. Nobody ever pays more than menu price.",
        placeholder: false,
      },
      {
        question: "Can a guest pick both sides?",
        answer:
          "No. It's one pick per tab, and a tab can never hold both sides of the same game. Managers can void a pick, and reports flag anything odd.",
        placeholder: false,
      },
      {
        question: "What about ties or postponed games?",
        answer:
          "By default a tie settles at full price and a postponed or cancelled game voids its picks.",
        placeholder: false,
      },
      {
        question: "Do guests need an app or an account?",
        answer:
          "No. They tell the bartender their side. Scanning the QR code to follow along on their phone is optional.",
        placeholder: false,
      },
    ],
  },
];

export const featuredFaq: FaqItem[] = faqGroups
  .flatMap((group) => group.items)
  .filter((item) => item.featured);

export const faqPage = {
  eyebrow: "FAQ",
  headline: "Fair questions, straight answers",
  subline:
    "Everything owners and managers ask before their first Sunday. Don't see yours? Ask us on a demo.",
};
