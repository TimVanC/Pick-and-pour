import type { Metadata } from "next";
import { DemoForm } from "@/components/marketing/DemoForm";
import { PageHero, containerClass } from "@/components/marketing/sections";
import { demoPage } from "@/content/demo";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "See Pick & Pour in 15 minutes: the bartender screen, the TV board, and the numbers for a bar your size.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow={demoPage.eyebrow}
        headline={demoPage.headline}
        subline={demoPage.subline}
      />
      <section className="bg-cream">
        <div
          className={`${containerClass} grid gap-10 py-12 lg:grid-cols-[1fr_1.6fr] lg:py-20`}
        >
          <ul className="grid content-start gap-4">
            {demoPage.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-lg">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold font-bold"
                >
                  ✓
                </span>
                {bullet}
              </li>
            ))}
          </ul>
          <DemoForm />
        </div>
      </section>
    </>
  );
}
