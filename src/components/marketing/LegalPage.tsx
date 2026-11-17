import type { ReactNode } from "react";
import { legalNotice } from "@/content/legal";
import { PageHero, containerClass } from "./sections";

/** Shared shell for /terms, /privacy and /house-rules. */
export function LegalPage({
  title,
  subline,
  children,
}: {
  title: string;
  subline?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow="Legal" headline={title} subline={subline} />
      <section className="bg-cream">
        <div className={`${containerClass} max-w-3xl py-14 lg:py-20`}>
          <p className="rounded-2xl border-2 border-dashed border-tomato px-5 py-4 font-semibold text-tomato">
            {legalNotice}
          </p>
          {children}
        </div>
      </section>
    </>
  );
}

export function LegalSections({
  sections,
}: {
  sections: { heading: string; paragraphs: string[] }[];
}) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="font-display text-2xl font-bold uppercase">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-lg text-charcoal/80">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
