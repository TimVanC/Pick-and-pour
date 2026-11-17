/**
 * Home page copy. ALL OF THIS IS PLACEHOLDER COPY until reviewed.
 * Items with `placeholder: true` show a visible "Placeholder" tag on the page.
 * Brand rule: never use sportsbook words here. Say "lock in" and "line".
 */

export const hero = {
  eyebrow: "For bars that aren't sports bars",
  headline: ["Dead Sunday?", "Make it game day."],
  subline:
    "Guests pick a side in the game on your TV. If their team wins, their tab drops. The bigger the underdog, the bigger the drop.",
  footnote: "Free for guests. Never above menu price.",
  boardCaption: "Demo board with made-up teams and numbers",
};

/** Teams are fictional on purpose. PLACEHOLDER until real examples are cleared. */
export type DemoSide = {
  abbr: string;
  name: string;
  score: number;
  /** American line at kickoff. */
  entryLine: number;
};

export type DemoGame = {
  id: string;
  period: string;
  /** Seconds left in the period when the page loads. */
  clockSeconds: number;
  /** Live win chance of side A when the page loads. */
  liveProbabilityA: number;
  sides: [DemoSide, DemoSide];
};

export const demoBoard = {
  title: "Pick & Pour",
  nextLockIn: "Next lock-in: halftime",
  games: [
    {
      id: "herons-monarchs",
      period: "Q2",
      clockSeconds: 252,
      liveProbabilityA: 0.4,
      sides: [
        { abbr: "HOB", name: "Herons", score: 17, entryLine: 500 },
        { abbr: "MID", name: "Monarchs", score: 10, entryLine: -400 },
      ],
    },
    {
      id: "foxes-captains",
      period: "Q2",
      clockSeconds: 487,
      liveProbabilityA: 0.47,
      sides: [
        { abbr: "ASB", name: "Foxes", score: 7, entryLine: -130 },
        { abbr: "CAP", name: "Captains", score: 10, entryLine: 110 },
      ],
    },
  ] satisfies DemoGame[],
};

export const ticker: string[] = [
  "Pick a side",
  "Team wins, tab drops",
  "Bigger underdog, bigger drop",
  "Lock in at the break",
  "Free to play",
  "Never above menu price",
  "No new hardware",
  "You set the limits",
];

export const problem = {
  eyebrow: "The dead-Sunday problem",
  headline: "The dining room is full. The bar is a ghost town.",
  body: [
    "Once the weather turns, football Sundays pull your bar crowd to the sports bar down the street. The tables hold up. The stools don't.",
    "Nobody has a reason to sit at your bar for a whole game. Pick & Pour gives them one.",
  ],
  stats: [
    { value: "3 hrs", label: "a game keeps a guest in their seat", placeholder: true },
    { value: "[X]%", label: "more Sunday bar sales at our pilot bar", placeholder: true },
    { value: "$0", label: "in new hardware", placeholder: false },
  ],
  image: {
    label: "Photo: empty bar stools on a Sunday afternoon",
    placeholder: true,
  },
};

export const howItWorks = {
  eyebrow: "How it works",
  headline: "Four steps. Three taps for the bartender.",
  steps: [
    {
      title: "Feature the games",
      body: "Before Sunday, pick which games are in play for the 1pm, 4pm and night windows.",
    },
    {
      title: "Guests pick a side",
      body: "Your bartender tags the tab with the pick. The TV shows what every side is worth right now.",
    },
    {
      title: "Lock in at the break",
      body: "Team looking good at halftime? A guest can lock in a smaller drop on the spot, or hold out for the final whistle.",
    },
    {
      title: "Team wins, tab drops",
      body: "At close-out the app shows the discount. Apply it in your POS like any other. Team lost? Full price, no hard feelings.",
    },
  ],
};

export const underdog = {
  eyebrow: "Underdog = bigger drop",
  headline: "The longer the shot, the sweeter the tab.",
  body: "Every drop is set by the live line, so every pick costs you about the same on average. Favorites pay a little. Long shots pay a lot, and rarely.",
  /** Each row is one side of a game: [that side's line, the other side's line]. */
  rows: [
    { label: "Heavy favorite", line: -400, otherLine: 500 },
    { label: "Coin flip", line: 110, otherLine: -130 },
    { label: "Big underdog", line: 500, otherLine: -400 },
  ],
  footnote:
    "Example at the default New Jersey settings. You choose the scale and the cap.",
};

export const whyBarsLoveIt = {
  eyebrow: "Why bars love it",
  headline: "A reason to stay for the fourth quarter.",
  cards: [
    {
      title: "Longer stays",
      body: "A guest with a pick riding on the game orders another round instead of the check.",
    },
    {
      title: "A weekly reason to come in",
      body: "Sunday becomes a standing date. Opt-in reminders bring last week's players back.",
    },
    {
      title: "You set the limits",
      body: "Cap the discount, cap the covered spend, choose the games. The house rules are yours.",
    },
    {
      title: "No new hardware",
      body: "It runs on the tablet behind your bar and the TV already on your wall.",
    },
  ],
};

export const foundingOffer = {
  eyebrow: "Founding bars",
  headline: "First 10 bars play free for a season.",
  body: "Be one of our founding bars: your first season is on us, and you help shape what we build next.",
  spots: { total: 10, placeholder: true },
};

export const testimonials = {
  eyebrow: "From behind the bar",
  headline: "What owners are saying",
  items: [
    {
      quote:
        "Placeholder quote: our Sunday bar seats went from empty to elbow-to-elbow by the second week.",
      name: "Owner name",
      venue: "Bar name, City NJ",
      placeholder: true,
    },
    {
      quote:
        "Placeholder quote: three taps and I'm back to pouring. The TV does the selling for me.",
      name: "Bartender name",
      venue: "Bar name, City NJ",
      placeholder: true,
    },
    {
      quote:
        "Placeholder quote: guests ask what's on the board before they ask for a menu.",
      name: "Manager name",
      venue: "Bar name, City NJ",
      placeholder: true,
    },
  ],
};

/** The questions themselves live in content/faq.ts (items marked `featured`). */
export const faq = {
  eyebrow: "FAQ",
  headline: "Fair questions",
  moreLabel: "All questions",
};

export const finalCta = {
  headline: "Fill the stools this Sunday.",
  body: "See the bartender screen and the TV board in a 15-minute demo.",
};
