import type { Metadata } from "next";
import {
  CtaBand,
  PageHero,
  PlaceholderImage,
  containerClass,
  h2Class,
} from "@/components/marketing/sections";
import { PlaceholderTag } from "@/components/marketing/ui";
import { aboutPage, founderStory, values } from "@/content/about";

export const metadata: Metadata = {
  title: "About",
  description:
    "Pick & Pour is built in New Jersey by a bartender who writes software, for bars that want their Sunday crowd back.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero {...aboutPage} />

      <section className="bg-cream">
        <div
          className={`${containerClass} grid gap-10 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24`}
        >
          <div>
            <h2 className={h2Class}>{founderStory.headline}</h2>
            {founderStory.placeholder && <PlaceholderTag className="mt-4" />}
            {founderStory.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-5 text-lg text-charcoal/80">
                {paragraph}
              </p>
            ))}
            <p className="mt-6 font-display text-xl font-semibold uppercase">
              {founderStory.signature}
            </p>
          </div>
          <PlaceholderImage label={founderStory.photoLabel} className="min-h-80" />
        </div>
      </section>

      <section className="bg-cream-200">
        <div className={`${containerClass} py-16 lg:py-24`}>
          <ul className="grid gap-4 lg:grid-cols-3">
            {values.map((value) => (
              <li
                key={value.title}
                className="rounded-3xl border-2 border-charcoal bg-cream p-6 shadow-[6px_6px_0_0_var(--color-charcoal)]"
              >
                <h3 className="font-display text-2xl font-semibold uppercase">
                  {value.title}
                </h3>
                <p className="mt-2 text-lg text-charcoal/80">
                  {value.body} {value.placeholder && <PlaceholderTag />}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        id="about_final"
        headline="Come see what we built."
        body="A 15-minute demo, bartender to bar owner."
      />
    </>
  );
}
