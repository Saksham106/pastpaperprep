import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => <i data-testid="vercel-analytics" /> }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => <i data-testid="vercel-speed-insights" /> }));

import { SiteTelemetry } from "@/components/SiteTelemetry";

describe("Vercel telemetry", () => {
  it("mounts privacy-friendly traffic analytics and real-user performance tracking", () => {
    render(<SiteTelemetry />);
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
    expect(screen.getByTestId("vercel-speed-insights")).toBeInTheDocument();
  });

  it("mounts telemetry once in the root layout", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(source.match(/<SiteTelemetry\s*\/>/g)).toHaveLength(1);
  });
});
