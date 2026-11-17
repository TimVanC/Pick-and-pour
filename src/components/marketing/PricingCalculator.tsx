"use client";

import { useState } from "react";
import { calculator, plans } from "@/content/pricing";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "What's one good Sunday worth?": extra guests × average tab vs. plan price. */
export function PricingCalculator() {
  const [guests, setGuests] = useState(calculator.guests.default);
  const [tab, setTab] = useState(calculator.tab.default);
  const [planId, setPlanId] = useState(plans[0].id);

  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const perGameDay = guests * tab;
  const perMonth = perGameDay * calculator.gameDaysPerMonth;
  const guestsToCoverPlan = Math.ceil(plan.monthly / tab);
  const multiple = perMonth / plan.monthly;

  return (
    <div className="grid gap-6 rounded-3xl border-2 border-charcoal bg-charcoal p-5 text-cream sm:p-8 lg:grid-cols-2 lg:gap-10">
      <div className="grid content-start gap-6">
        <Slider
          id="calc-guests"
          label={calculator.guests.label}
          value={guests}
          display={String(guests)}
          min={calculator.guests.min}
          max={calculator.guests.max}
          step={1}
          onChange={setGuests}
        />
        <Slider
          id="calc-tab"
          label={calculator.tab.label}
          value={tab}
          display={dollars.format(tab)}
          min={calculator.tab.min}
          max={calculator.tab.max}
          step={calculator.tab.step}
          onChange={setTab}
        />
        <div>
          <label
            htmlFor="calc-plan"
            className="font-display text-lg uppercase tracking-wide"
          >
            {calculator.planLabel}
          </label>
          <select
            id="calc-plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className="mt-2 min-h-14 w-full rounded-2xl border-2 border-cream/30 bg-charcoal-800 px-4 text-lg text-cream"
          >
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}: {dollars.format(item.monthly)}/mo
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        aria-live="polite"
        className="grid content-start gap-4 rounded-2xl bg-charcoal-800 p-5"
      >
        <Result label="Extra bar revenue per game day" value={dollars.format(perGameDay)} />
        <Result
          label={`Per month (${calculator.gameDaysPerMonth} game days)`}
          value={dollars.format(perMonth)}
          big
        />
        <Result label={`${plan.name} plan`} value={`${dollars.format(plan.monthly)}/mo`} />
        <p className="border-t border-cream/10 pt-4 text-lg text-cream/85">
          That&apos;s{" "}
          <strong className="text-gold">
            {multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×
          </strong>{" "}
          the plan price. The plan pays for itself with{" "}
          <strong className="text-gold">
            {guestsToCoverPlan} extra {guestsToCoverPlan === 1 ? "guest" : "guests"}
          </strong>{" "}
          a month.
        </p>
        <p className="text-sm text-cream/60">{calculator.footnote}</p>
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-display text-lg uppercase tracking-wide">
          {label}
        </label>
        <output
          htmlFor={id}
          className="font-display text-3xl font-bold tabular-nums text-gold"
        >
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-10 w-full accent-gold"
      />
    </div>
  );
}

function Result({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-cream/75">{label}</span>
      <span
        className={`font-display font-bold tabular-nums ${big ? "text-5xl text-gold" : "text-2xl"}`}
      >
        {value}
      </span>
    </div>
  );
}
