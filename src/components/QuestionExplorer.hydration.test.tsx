import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").filter((question) => isPreviewQuestion("ib-sl", question.id)).slice(0, 3), []);

function explorer() {
  return <QuestionExplorer questions={questions} bankSlug="ib-sl" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} hydrateFromLocation />;
}

describe("QuestionExplorer hydration", () => {
  let root: Root | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  });

  // Bank pages are static: the server HTML never sees the query string. A saved worksheet
  // opens as /banks/<bank>?worksheet=<id>, which used to change the first client render
  // and throw React #418 in production.
  it.each(["?worksheet=7f1b6a2e-0000-4000-8000-000000000000", "?worksheet=7f1b6a2e-0000-4000-8000-000000000000&mode=edit"])("hydrates a static bank page opened at %s without a mismatch", async (query) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    window.history.replaceState(null, "", "/banks/ib-sl");
    const container = document.createElement("div");
    container.innerHTML = renderToString(explorer());
    document.body.append(container);

    window.history.replaceState(null, "", `/banks/ib-sl${query}`);
    const recoverable = vi.fn();
    await act(async () => { root = hydrateRoot(container, explorer(), { onRecoverableError: recoverable }); });

    expect(recoverable).not.toHaveBeenCalled();
    // Straight after hydration the explorer switches to the saved worksheet.
    expect(container.querySelector(".worksheet-workspace a[href='/worksheets']")).not.toBeNull();
    expect(window.location.search).toContain("worksheet=7f1b6a2e-0000-4000-8000-000000000000");
  });
});
