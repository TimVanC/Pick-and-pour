import type { Metadata } from "next";
import {
  CtaBand,
  FaqList,
  PageHero,
  containerClass,
} from "@/components/marketing/sections";
import { faqGroups, faqPage } from "@/content/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers for bar owners: is it gambling, is it legal in my state, what it costs per night, hardware and POS questions.",
  alternates: { canonical: "/faq" },
};

/** FAQ structured data so search engines can show the questions. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqGroups
    .flatMap((group) => group.items)
    // Leave unreviewed placeholder answers out of search results.
    .filter((item) => !item.placeholder)
    .map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PageHero {...faqPage} />
      <section className="bg-cream-200">
        <div className={`${containerClass} max-w-3xl py-16 lg:py-24`}>
          <div className="grid gap-12">
            {faqGroups.map((group) => (
              <div key={group.title}>
                <h2 className="mb-5 font-display text-3xl font-bold uppercase">
                  {group.title}
                </h2>
                <FaqList items={group.items} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand
        id="faq_final"
        headline="Still have a question?"
        body="Ask it on a 15-minute demo."
        showSecondary={false}
      />
    </>
  );
}
