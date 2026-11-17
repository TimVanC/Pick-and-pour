import type { Metadata } from "next";
import { PricingCalculator } from "@/components/marketing/PricingCalculator";
import {
  CtaBand,
  FaqList,
  PageHero,
  containerClass,
  h2Class,
} from "@/components/marketing/sections";
import { ButtonLink, Eyebrow } from "@/components/marketing/ui";
import {
  calculator,
  foundingPlan,
  plans,
  pricingFaq,
  pricingPage,
} from "@/content/pricing";
import { cta } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pick & Pour plans: single sport $99/mo, two-sport combo $149/mo, all sports $179/mo or $1,799/yr. Founding bars play free for a season.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <PageHero {...pricingPage} />

      <section className="bg-cream">
        <div className={`${containerClass} py-16 lg:py-24`}>
          <ul className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className={`flex flex-col rounded-3xl border-2 border-charcoal p-6 shadow-[6px_6px_0_0_var(--color-charcoal)] ${
                  plan.highlighted ? "bg-gold" : "bg-white/60"
                }`}
              >
                <h2 className="font-display text-2xl font-bold uppercase">
                  {plan.name}
                </h2>
                <p className="mt-1 text-charcoal/80">{plan.description}</p>
                <p className="mt-5 font-display text-6xl font-bold tabular-nums">
                  ${plan.monthly}
                </p>
                <p className="text-sm text-charcoal/80">{plan.priceNote}</p>
                <ul className="mt-5 grid flex-1 content-start gap-2 text-lg">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="font-bold text-tomato">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={cta.primary.href}
                  event={`pricing_plan_${plan.id}`}
                  className="mt-6 w-full"
                >
                  {cta.primary.label}
                </ButtonLink>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-6 rounded-3xl bg-tomato p-6 text-cream sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold uppercase">
                {foundingPlan.name}: {foundingPlan.price} {foundingPlan.priceNote}
              </h2>
              <p className="mt-2 text-lg text-cream/90">{foundingPlan.body}</p>
            </div>
            <ButtonLink
              href={cta.founding.href}
              variant="gold"
              event="pricing_claim_spot"
              className="shrink-0"
            >
              {cta.founding.label}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="bg-cream-200">
        <div className={`${containerClass} py-16 lg:py-24`}>
          <Eyebrow className="text-tomato">{calculator.eyebrow}</Eyebrow>
          <h2 className={`${h2Class} mt-3`}>{calculator.headline}</h2>
          <p className="mt-4 max-w-2xl text-lg text-charcoal/80">
            {calculator.body}
          </p>
          <div className="mt-8">
            <PricingCalculator />
          </div>
        </div>
      </section>

      <section className="bg-cream">
        <div className={`${containerClass} max-w-3xl py-16 lg:py-24`}>
          <h2 className={h2Class}>Pricing questions</h2>
          <div className="mt-8">
            <FaqList items={pricingFaq} />
          </div>
        </div>
      </section>

      <CtaBand
        id="pricing_final"
        headline="One good Sunday covers it."
        body="See the numbers for your bar on a 15-minute demo."
        showSecondary={false}
      />
    </>
  );
}
