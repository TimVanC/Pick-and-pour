import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { houseRules } from "@/content/legal";

export const metadata: Metadata = {
  title: houseRules.title,
  description: houseRules.description,
  alternates: { canonical: "/house-rules" },
};

export default function HouseRulesPage() {
  return (
    <LegalPage title={houseRules.title} subline={houseRules.intro}>
      <div className="mt-10 grid gap-6">
        {houseRules.profiles.map((profile) => (
          <section
            key={profile.code}
            className="rounded-3xl border-2 border-charcoal bg-white/60 p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-3xl font-bold uppercase">
                {profile.name}
              </h2>
              <p className="text-sm font-semibold uppercase tracking-wider text-tomato">
                {profile.status}
              </p>
            </div>
            <ul className="mt-4 grid list-disc gap-2 pl-5 text-lg text-charcoal/80">
              {profile.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </LegalPage>
  );
}
