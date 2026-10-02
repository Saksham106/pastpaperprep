import { BrowserErrorMonitor } from "@/components/BrowserErrorMonitor";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function SiteTelemetry() {
  return (
    <>
      <BrowserErrorMonitor />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
