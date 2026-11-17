import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestPage } from "@/components/app/GuestPage";

export const metadata: Metadata = {
  title: "Your pick",
  robots: { index: false, follow: false },
};

/** A guest's own pick, reached from the QR code. No account, no app. */
export default function GuestPickPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-charcoal" />}>
      <GuestPage />
    </Suspense>
  );
}
