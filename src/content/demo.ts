/** /demo copy and form options. PLACEHOLDER COPY until reviewed. */

export const demoPage = {
  eyebrow: "Book a demo",
  headline: "See it run in 15 minutes.",
  subline:
    "Tell us about your bar and we'll show you the bartender screen and the TV board with this week's games.",
  bullets: [
    "A live look at the bartender screen and TV board",
    "The numbers for a bar your size",
    "Founding spots: first 10 bars free for a season",
  ],
};

export const roles = ["Owner", "General manager", "Bar manager", "Bartender", "Other"] as const;

export const sports = [
  "Pro football",
  "College football",
  "Pro basketball",
  "College basketball",
  "Hockey",
  "Baseball",
] as const;

export const tvOptions = ["1", "2 to 3", "4 to 6", "7 or more"] as const;

export const demoForm = {
  labels: {
    name: "Your name",
    barName: "Bar name",
    cityState: "City and state",
    role: "Your role",
    phone: "Phone",
    email: "Email",
    sports: "Sports you care about",
    tvs: "How many TVs?",
    notes: "Anything else?",
  },
  placeholders: {
    cityState: "Hoboken, NJ",
    notes: "Busy nights, slow nights, questions",
  },
  submit: "Book my demo",
  submitting: "Sending…",
  consent:
    "We'll only use this to set up your demo. No spam, no sharing.",
  errors: {
    generic: "Something went wrong on our side. Please try again in a minute.",
    rateLimited: "That's a lot of requests. Please try again in a little while.",
    invalid: "Please check the highlighted fields.",
    required: "Required",
    email: "Enter a valid email",
    phone: "Enter a valid phone number",
  },
};

export const thankYou = {
  headline: "You're on the board.",
  body: "Thanks! We got your request.",
  nextSteps: [
    "We'll reach out within one business day to pick a time.",
    "The demo takes about 15 minutes, by video or at your bar.",
    "Bring your questions about limits, your POS and your state's rules.",
  ],
  placeholder: true,
};
