import type { Metadata } from "next";
import { BartenderApp } from "@/components/app/BartenderApp";

export const metadata: Metadata = {
  title: "Bartender app",
  description: "Run Pick & Pour behind the bar: picks, lock-ins and settlement.",
  robots: { index: false, follow: false },
};

/** The bartender and manager app. Everything loads in the browser after sign-in. */
export default function AppPage() {
  return <BartenderApp />;
}
