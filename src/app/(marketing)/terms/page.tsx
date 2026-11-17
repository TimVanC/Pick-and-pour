import type { Metadata } from "next";
import { LegalPage, LegalSections } from "@/components/marketing/LegalPage";
import { terms } from "@/content/legal";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title={terms.title} subline={`Last updated: ${terms.updated}`}>
      <LegalSections sections={terms.sections} />
    </LegalPage>
  );
}
