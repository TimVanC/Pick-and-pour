import type { Metadata } from "next";
import Link from "next/link";
import {
  CtaBand,
  FaqList,
  PlaceholderImage,
  containerClass,
  h2Class,
} from "@/components/marketing/sections";
import { featuredFaq } from "@/content/faq";
import { Ticker } from "@/components/marketing/Ticker";
import { TvBoard } from "@/components/marketing/TvBoard";
import { ButtonLink, Eyebrow, PlaceholderTag } from "@/components/marketing/ui";
import {
  faq,
  finalCta,
  foundingOffer,
  hero,
  howItWorks,
  problem,
  testimonials,
  underdog,
  whyBarsLoveIt,
} from "@/content/home";
import { cta } from "@/content/site";
import {
  NJ_DEFAULT_PROFILE,
  formatPercent,
  vigFreeProbability,
  winDiscount,
} from "@/lib/discount";

const h2 = h2Class;
const container = containerClass;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <Problem />
      <HowItWorks />
      <Underdog />
      <WhyBarsLoveIt />
      <FoundingOffer />
      <Testimonials />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-charcoal text-cream">
      <div
        className={`${container} grid items-center gap-10 pt-8 pb-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-14 lg:pb-20`}
      >
        <div>
          <Eyebrow className="text-gold">{hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 font-display text-6xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl">
            {hero.headline[0]}
            <span className="block text-balance text-gold">{hero.headline[1]}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-cream/85 sm:text-xl">
            {hero.subline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={cta.primary.href} event="hero_book_demo">
              {cta.primary.label}
            </ButtonLink>
            <ButtonLink
              href={cta.secondary.href}
              variant="onDark"
              event="hero_how_it_works"
            >
              {cta.secondary.label}
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-cream/60">{hero.footnote}</p>
        </div>

        <div>
          <TvBoard />
          <p className="mt-3 text-center text-xs text-cream/50">
            {hero.boardCaption}
          </p>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-cream">
      <div className={`${container} grid gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
        <div>
          <Eyebrow className="text-tomato">{problem.eyebrow}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{problem.headline}</h2>
          {problem.body.map((paragraph) => (
            <p key={paragraph} className="mt-5 text-lg text-charcoal/80">
              {paragraph}
            </p>
          ))}
          <dl className="mt-8 grid grid-cols-3 gap-3">
            {problem.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border-2 border-charcoal bg-white/60 p-4"
              >
                <dd className="font-display text-3xl font-bold text-tomato sm:text-4xl">
                  {stat.value}
                </dd>
                <dt className="mt-1 text-sm text-charcoal/80">
                  {stat.label} {stat.placeholder && <PlaceholderTag />}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <PlaceholderImage label={problem.image.label} />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="bg-charcoal text-cream">
      <div className={`${container} py-16 lg:py-24`}>
        <Eyebrow className="text-gold">{howItWorks.eyebrow}</Eyebrow>
        <h2 className={`${h2} mt-3 max-w-3xl`}>{howItWorks.headline}</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="rounded-3xl bg-charcoal-800 p-6">
              <span className="flex size-12 items-center justify-center rounded-full bg-gold font-display text-2xl font-bold text-charcoal">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl font-semibold uppercase">
                {step.title}
              </h3>
              <p className="mt-2 text-cream/75">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <ButtonLink
            href={cta.secondary.href}
            variant="onDark"
            event="steps_how_it_works"
          >
            {cta.secondary.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Underdog() {
  const rows = underdog.rows.map((row) => {
    const p = vigFreeProbability(row.line, row.otherLine);
    return { ...row, p, drop: winDiscount(NJ_DEFAULT_PROFILE, p) };
  });

  return (
    <section className="bg-cream">
      <div
        className={`${container} grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24`}
      >
        <div>
          <Eyebrow className="text-tomato">{underdog.eyebrow}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{underdog.headline}</h2>
          <p className="mt-5 text-lg text-charcoal/80">{underdog.body}</p>
        </div>

        <div className="rounded-3xl border-2 border-charcoal bg-charcoal p-5 text-cream sm:p-7">
          <ul className="grid gap-5">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-xl font-semibold uppercase">
                    {row.label}
                  </span>
                  <span className="text-sm tabular-nums text-cream/70">
                    {row.line > 0 ? `+${row.line}` : `−${Math.abs(row.line)}`} ·
                    wins {formatPercent(row.p)} of the time
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-10 flex-1 rounded-full bg-charcoal-700">
                    <div
                      className="flex h-full items-center justify-end rounded-full bg-gold pr-3"
                      style={{ width: `${Math.max(18, row.drop * 100)}%` }}
                    >
                      <span className="font-display text-lg font-bold tabular-nums text-charcoal">
                        {formatPercent(row.drop)}
                      </span>
                    </div>
                  </div>
                  <span className="w-14 text-xs uppercase tracking-wider text-cream/60">
                    off the tab
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-cream/60">{underdog.footnote}</p>
        </div>
      </div>
    </section>
  );
}

function WhyBarsLoveIt() {
  return (
    <section className="bg-cream-200">
      <div className={`${container} py-16 lg:py-24`}>
        <Eyebrow className="text-tomato">{whyBarsLoveIt.eyebrow}</Eyebrow>
        <h2 className={`${h2} mt-3 max-w-3xl`}>{whyBarsLoveIt.headline}</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {whyBarsLoveIt.cards.map((card) => (
            <li
              key={card.title}
              className="rounded-3xl border-2 border-charcoal bg-cream p-6 shadow-[6px_6px_0_0_var(--color-charcoal)]"
            >
              <h3 className="font-display text-2xl font-semibold uppercase">
                {card.title}
              </h3>
              <p className="mt-2 text-lg text-charcoal/80">{card.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FoundingOffer() {
  return (
    <section className="bg-tomato text-cream">
      <div
        className={`${container} flex flex-col gap-8 py-14 lg:flex-row lg:items-center lg:justify-between lg:py-16`}
      >
        <div className="max-w-2xl">
          <Eyebrow className="text-cream">{foundingOffer.eyebrow}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{foundingOffer.headline}</h2>
          <p className="mt-4 text-lg text-cream/90">{foundingOffer.body}</p>
        </div>
        <ButtonLink
          href={cta.founding.href}
          variant="gold"
          event="founding_claim_spot"
          className="shrink-0"
        >
          {cta.founding.label}
        </ButtonLink>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-cream">
      <div className={`${container} py-16 lg:py-24`}>
        <Eyebrow className="text-tomato">{testimonials.eyebrow}</Eyebrow>
        <h2 className={`${h2} mt-3`}>{testimonials.headline}</h2>
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {testimonials.items.map((item) => (
            <li
              key={item.quote}
              className="flex flex-col rounded-3xl border-2 border-dashed border-charcoal/40 bg-white/50 p-6"
            >
              {item.placeholder && <PlaceholderTag className="self-start" />}
              <blockquote className="mt-3 flex-1 text-lg text-charcoal/85">
                “{item.quote}”
              </blockquote>
              <p className="mt-5 font-display text-lg font-semibold uppercase">
                {item.name}
              </p>
              <p className="text-sm text-charcoal/70">{item.venue}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="bg-cream-200">
      <div className={`${container} max-w-3xl py-16 lg:py-24`}>
        <Eyebrow className="text-tomato">{faq.eyebrow}</Eyebrow>
        <h2 className={`${h2} mt-3`}>{faq.headline}</h2>
        <div className="mt-8">
          <FaqList items={featuredFaq} />
        </div>
        <p className="mt-6">
          <Link
            href="/faq"
            className="font-display text-lg font-semibold uppercase tracking-wide text-tomato underline underline-offset-4 hover:text-tomato-600"
          >
            {faq.moreLabel} →
          </Link>
        </p>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <CtaBand id="home_final" headline={finalCta.headline} body={finalCta.body} />
  );
}
