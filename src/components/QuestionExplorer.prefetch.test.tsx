import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import type Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Expose the prefetch decision at the framework boundary; real Next Link is covered by
// IntentPrefetchLink.native.test.tsx.
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string; transitionTypes?: unknown }) => { const { transitionTypes, ...anchor } = props; void transitionTypes; return <a {...anchor} data-prefetch={String(prefetch)} />; } }));
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: vi.fn() }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { freeAssetResponse, isFreeAssetRequest } from "../../test/free-asset-fetch";

const bank = loadBankQuestions("igcse");
const questions = prepareQuestionsForDelivery([
  ...bank.filter((question) => isPreviewQuestion("igcse", question.id)).slice(0, 12),
  ...bank.filter((question) => !isPreviewQuestion("igcse", question.id)).slice(0, 12),
], []);

describe("practice page prefetch", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/banks/igcse");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => isFreeAssetRequest(input) ? freeAssetResponse(input) : new Response("{}", { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  // Upgrade, login and worksheet links render per request; viewport prefetch cost a function
  // invocation per page view (and per distinct upgrade URL) before anyone clicked.
  it("defers every explorer link until intent, including upgrade links on locked questions", () => {
    render(<QuestionExplorer questions={questions} bankSlug="igcse" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[data-prefetch]")];
    expect(links.some((link) => link.getAttribute("href")?.startsWith("/pricing"))).toBe(true);
    for (const link of links) expect(link, link.getAttribute("href") ?? "").toHaveAttribute("data-prefetch", "false");
  });

  it("defers the bank hero's paper-builder link until intent", () => {
    const page = readFileSync("src/app/banks/[slug]/page.tsx", "utf8");
    expect(page).toContain('<IntentPrefetchLink className="button secondary bank-hero-build" data-signed-in-only href={buildPaperPath(slug)}>');
    expect(page).toContain('<IntentPrefetchLink className="button secondary bank-hero-build" data-signed-out-only href={buildPaperLoginPath(slug)}>');
  });
});
