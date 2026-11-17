import { CtaTracker, StickyCta } from "@/components/marketing/client";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <StickyCta />
      <CtaTracker />
    </>
  );
}
