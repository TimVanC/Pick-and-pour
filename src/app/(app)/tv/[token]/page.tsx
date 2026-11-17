import type { Metadata } from "next";
import { Suspense } from "react";
import { TvBoardLive } from "@/components/app/TvBoardLive";

export const metadata: Metadata = {
  title: "TV board",
  robots: { index: false, follow: false },
};

/** The venue's TV board, opened full-screen on the bar TV from a secret link. */
export default function TvPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-charcoal" />}>
      <TvBoardLive />
    </Suspense>
  );
}
