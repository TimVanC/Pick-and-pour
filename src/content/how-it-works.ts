/** /how-it-works copy. PLACEHOLDER COPY until reviewed. */

export const howItWorksPage = {
  eyebrow: "How it works",
  headline: "A Sunday with Pick & Pour",
  subline:
    "Your POS still rings the orders. Pick & Pour adds the game: one screen for the bartender, one board on the TV, one page on the guest's phone.",
};

export type WalkthroughStep = {
  time: string;
  title: string;
  body: string;
  /** Which mockup to show beside the step. */
  visual: "bartender" | "tv" | "guest" | "none";
  /** Label for the placeholder screenshot. */
  screenshotLabel?: string;
};

export const walkthrough: { headline: string; steps: WalkthroughStep[] } = {
  headline: "Game-day walkthrough",
  steps: [
    {
      time: "Before Sunday",
      title: "You feature the games",
      body: "Toggle on the games you want for each window: 1pm, 4pm and the night game. Pin your local teams so they are pre-selected every week.",
      visual: "none",
    },
    {
      time: "A guest sits down",
      title: "Three taps to tag a tab",
      body: "The bartender taps the game, the side, then a tab label like “Sam, seat 4”. The app records the live line and shows what the pick is worth.",
      visual: "bartender",
      screenshotLabel: "Screenshot: bartender New pick screen",
    },
    {
      time: "All game long",
      title: "The TV does the selling",
      body: "The board shows every featured game and what each side is worth right now. No guest names, no clutter.",
      visual: "tv",
    },
    {
      time: "On their phone",
      title: "Guests follow their own number",
      body: "A QR code opens the guest's pick: their side, their line, and their live lock-in value. No app, no account.",
      visual: "guest",
      screenshotLabel: "Screenshot: guest page on a phone",
    },
    {
      time: "Close-out",
      title: "Team wins, tab drops",
      body: "The bartender enters the tab subtotal and the app shows the discount as a percent and in dollars. Apply it with your POS discount button and tap Mark applied.",
      visual: "bartender",
      screenshotLabel: "Screenshot: bartender Settle screen",
    },
  ],
};

export const lockIns = {
  eyebrow: "Lock-ins",
  headline: "A little now, or the whole drop later.",
  body: "At a quarter break or halftime, a guest whose side is doing better than at kickoff can lock in a smaller discount on the spot. It keeps every break interesting, and it keeps guests in their seats for the next one.",
  /** Example for a +500 underdog at the default New Jersey settings. */
  example: {
    caption: "Example: a +500 underdog, default New Jersey settings",
    entryLine: 500,
    otherLine: -400,
    moments: [
      { label: "Kickoff", probability: null },
      { label: "Halftime, up 10", probability: 0.4 },
      { label: "Late 4th, in front", probability: 0.75 },
      { label: "Final: they win", probability: 1 },
    ],
  },
};

export const controls = {
  eyebrow: "Limits and controls",
  headline: "Your bar, your house rules.",
  items: [
    {
      title: "Scale",
      body: "Dial every discount up or down with one setting to land your average where you want it.",
    },
    {
      title: "Cap",
      body: "Set the biggest discount any pick can earn. Your state's rules profile sets the ceiling.",
    },
    {
      title: "Covered spend",
      body: "Cap how much of a tab a pick covers. The default is the first $100.",
    },
    {
      title: "Games and cutoffs",
      body: "You choose the games, and how late in a game a guest can still jump in.",
    },
    {
      title: "Staff PINs",
      body: "Bartenders switch with a 4-digit PIN, and every pick, lock-in and void is logged.",
    },
    {
      title: "Sunday report",
      body: "Picks, players, covered spend and discounts given, with a CSV export.",
    },
  ],
};

export const setup = {
  eyebrow: "Setup in 30 minutes",
  headline: "Live by kickoff.",
  steps: [
    { title: "10 min", body: "Choose your settings and feature this week's games." },
    { title: "5 min", body: "Open the board link on your TV or streaming stick." },
    { title: "15 min", body: "Walk your bartenders through the three-tap flow." },
  ],
  placeholder: true,
};
