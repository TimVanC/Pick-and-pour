import type { Metadata } from "next";
import { LegalPage, LegalSections } from "@/components/marketing/LegalPage";
import { privacy } from "@/content/legal";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title={privacy.title} subline={`Last updated: ${privacy.updated}`}>
      <LegalSections sections={privacy.sections} />
    </LegalPage>
  );
}
