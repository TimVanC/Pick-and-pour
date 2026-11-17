import type { Metadata } from "next";
import {
  CtaBand,
  PageHero,
  PlaceholderImage,
  containerClass,
  h2Class,
} from "@/components/marketing/sections";
import { TvBoard } from "@/components/marketing/TvBoard";
import { Eyebrow, PlaceholderTag } from "@/components/marketing/ui";
import {
  controls,
  howItWorksPage,
  lockIns,
  setup,
  walkthrough,
} from "@/content/how-it-works";
import {
  NJ_DEFAULT_PROFILE,
  formatPercent,
  lockInDiscount,
  vigFreeProbability,
  winDiscount,
} from "@/lib/discount";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "A game day with Pick & Pour, step by step: the bartender's three taps, the TV board, lock-ins at the break, and the limits you control.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero {...howItWorksPage} />
      <Walkthrough />
      <LockIns />
      <Controls />
      <Setup />
      <CtaBand
        id="how_final"
        headline="See it on your own TV."
        body="A 15-minute demo with this week's games."
        showSecondary={false}
      />
    </>
  );
}

function Walkthrough() {
  return (
    <section className="bg-cream">
      <div className={`${containerClass} py-16 lg:py-24`}>
        <h2 className={h2Class}>{walkthrough.headline}</h2>
        <ol className="mt-10 grid gap-12 lg:gap-16">
          {walkthrough.steps.map((step, index) => (
            <li
              key={step.title}
              className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12"
            >
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <p className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold font-display text-2xl font-bold text-charcoal">
                    {index + 1}
                  </span>
                  <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-tomato">
                    {step.time}
                  </span>
                </p>
                <h3 className="mt-4 font-display text-3xl font-bold uppercase">
                  {step.title}
                </h3>
                <p className="mt-3 text-lg text-charcoal/80">{step.body}</p>
              </div>
              <div>
                {step.visual === "tv" && <TvBoard />}
                {step.screenshotLabel && (
                  <PlaceholderImage
                    label={step.screenshotLabel}
                    className={
                      step.visual === "guest" ? "mx-auto max-w-xs min-h-96" : ""
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function LockIns() {
  const { example } = lockIns;
  const entry = vigFreeProbability(example.entryLine, example.otherLine);
  const dWin = winDiscount(NJ_DEFAULT_PROFILE, entry);
  const moments = example.moments.map((moment) => ({
    label: moment.label,
    value:
      moment.probability === null
        ? `${formatPercent(dWin)} off if they win`
        : moment.probability === 1
          ? `${formatPercent(dWin)} off`
          : `Lock in ${formatPercent(lockInDiscount(dWin, entry, moment.probability))}`,
  }));

  return (
    <section className="bg-charcoal text-cream">
      <div
        className={`${containerClass} grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24`}
      >
        <div>
          <Eyebrow className="text-gold">{lockIns.eyebrow}</Eyebrow>
          <h2 className={`${h2Class} mt-3`}>{lockIns.headline}</h2>
          <p className="mt-5 text-lg text-cream/80">{lockIns.body}</p>
        </div>
        <div className="rounded-3xl bg-charcoal-800 p-5 sm:p-7">
          <p className="text-sm text-cream/60">{example.caption}</p>
          <ol className="mt-4 grid gap-3">
            {moments.map((moment) => (
              <li
                key={moment.label}
                className="flex items-center justify-between gap-4 rounded-2xl bg-charcoal px-4 py-3"
              >
                <span className="font-display text-lg uppercase tracking-wide">
                  {moment.label}
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-gold">
                  {moment.value}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-cream/60">
            If the line moves against the pick, there is nothing to lock in and
            a loss is simply full price.
          </p>
        </div>
      </div>
    </section>
  );
}

function Controls() {
  return (
    <section className="bg-cream-200">
      <div className={`${containerClass} py-16 lg:py-24`}>
        <Eyebrow className="text-tomato">{controls.eyebrow}</Eyebrow>
        <h2 className={`${h2Class} mt-3`}>{controls.headline}</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {controls.items.map((item) => (
            <li
              key={item.title}
              className="rounded-3xl border-2 border-charcoal bg-cream p-6 shadow-[6px_6px_0_0_var(--color-charcoal)]"
            >
              <h3 className="font-display text-2xl font-semibold uppercase">
                {item.title}
              </h3>
              <p className="mt-2 text-lg text-charcoal/80">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Setup() {
  return (
    <section className="bg-cream">
      <div className={`${containerClass} py-16 lg:py-24`}>
        <Eyebrow className="text-tomato">{setup.eyebrow}</Eyebrow>
        <h2 className={`${h2Class} mt-3`}>
          {setup.headline} {setup.placeholder && <PlaceholderTag />}
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {setup.steps.map((step) => (
            <li
              key={step.title}
              className="rounded-3xl border-2 border-charcoal bg-white/60 p-6"
            >
              <p className="font-display text-4xl font-bold text-tomato">
                {step.title}
              </p>
              <p className="mt-2 text-lg text-charcoal/80">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
