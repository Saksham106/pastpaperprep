import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DashboardContent } from "@/components/DashboardContent";
import { PRACTICE_MODE_KEY, QUALIFICATION_KEY } from "@/components/QualificationTabs";
import { ECONOMICS_BANK_CATALOG, IGCSE_RELEASE_BANK_CATALOG, BANKS } from "@/lib/banks";

const rowsIn = (container: HTMLElement, panel: string) => [...container.querySelectorAll<HTMLAnchorElement>(`#${panel}-panel a[data-bank-slug]`)];

describe("DashboardContent", () => {
  beforeEach(() => window.localStorage.clear());

  it("puts included banks first, tags them, and keeps account tools in one disclosure", async () => {
    const { container } = render(<DashboardContent authenticated accessibleBanks={["ib-ai-hl"]} />);

    expect(screen.getByRole("heading", { name: /your study desk/i })).toBeInTheDocument();
    expect(screen.getByText(/account & settings/i)).toBeInTheDocument();
    const worksheetsLink = screen.getByRole("link", { name: /my worksheets/i });
    expect(worksheetsLink).toHaveAttribute("href", "/worksheets");
    expect(worksheetsLink.parentElement).toHaveClass("dashboard-heading-actions");
    expect(worksheetsLink.closest(".dashboard-qualification-row")).toBeNull();
    expect(worksheetsLink.closest('[role="tablist"]')).toBeNull();
    expect(screen.getByRole("link", { name: /my account/i })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: /password settings/i })).toHaveAttribute("href", "/account/password");
    expect(screen.getByRole("link", { name: /view your access/i })).toHaveAttribute("href", "/account/subscription");
    expect(screen.queryByRole("link", { name: /manage plan/i })).not.toBeInTheDocument();

    // An IB plan opens the IB tab, with the included course first in its card.
    await waitFor(() => expect(screen.getByRole("tab", { name: "IB Diploma" })).toHaveAttribute("aria-selected", "true"));
    const first = rowsIn(container, "ib-diploma")[0];
    expect(first.dataset.bankSlug).toBe("ib-ai-hl");
    expect(first).toHaveAttribute("href", "/banks/ib-ai-hl");
    expect(first).toHaveTextContent("Included");
    expect(rowsIn(container, "ib-diploma").filter((row) => row.textContent?.includes("Included"))).toHaveLength(1);
  });

  it("sends free visitors straight to free questions and keeps upgrade discovery visible", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    expect(screen.getByRole("link", { name: "Mathematics 0580, practice by topic" })).toHaveAttribute("href", "/banks/igcse?free=1");
    const plan = screen.getByRole("region", { name: "Your plan: Free" });
    expect(plan).toHaveTextContent("You have the free exam years of every bank.");
    expect(plan).toHaveTextContent("Plans add the newest papers, every mark scheme and PDFs. From $6/month.");
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/pricing?from=dashboard");
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Included")).not.toBeInTheDocument();
  });

  it("sends signed-in free students to plans rather than an empty subscription editor", () => {
    render(<DashboardContent authenticated accessibleBanks={[]} />);
    expect(screen.getAllByRole("link", { name: /see plans/i }).every((link) => link.getAttribute("href")?.startsWith("/pricing"))).toBe(true);
    expect(screen.queryByRole("link", { name: /view your access/i })).not.toBeInTheDocument();
  });

  it("uses the landing page's subject cards: one pastel card per subject, one row per course", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[...BANKS, ...IGCSE_RELEASE_BANK_CATALOG]} />);

    expect(container.querySelector(".dashboard-plan-card")?.compareDocumentPosition(container.querySelector("#cambridge-igcse-panel")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect([...container.querySelectorAll("#cambridge-igcse-panel h3")].map((h) => h.textContent)).toEqual(["Mathematics", "Chemistry", "Physics", "Biology", "Economics", "Co-ordinated Sciences"]);
    expect(rowsIn(container, "cambridge-igcse").map((row) => row.querySelector("strong")?.textContent)).toEqual([
      "Mathematics 0580", "Additional Mathematics 0606", "Chemistry 0620", "Physics 0625", "Biology 0610", "Economics 0455", "Co-ordinated Sciences 0654",
    ]);
    for (const row of rowsIn(container, "cambridge-igcse")) {
      expect(row.textContent).toMatch(/\d[\d,]*\squestions/);
      expect(row.closest("[data-subject-tone]")).not.toBeNull();
    }
    expect(container.querySelectorAll("#cambridge-igcse-panel [data-course-icon]")).toHaveLength(6);
    expect(container.querySelector("#cambridge-igcse-panel")).not.toHaveTextContent("Cambridge IGCSE");
  });

  it("shows activated Economics banks to an entitled All Access user", () => {
    render(
      <DashboardContent
        authenticated
        availableBanks={[...BANKS, ...ECONOMICS_BANK_CATALOG]}
        accessibleBanks={[...BANKS, ...ECONOMICS_BANK_CATALOG].map(({ slug }) => slug)}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));
    expect(screen.getByRole("heading", { name: "Economics" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IB Economics HL, practice by topic" })).toHaveAttribute("href", "/banks/ib-economics-hl");
    expect(screen.getByRole("link", { name: "IB Economics SL, practice by topic" })).toHaveAttribute("href", "/banks/ib-economics-sl");
  });

  it("separates Cambridge IGCSE and IB Diploma banks behind keyboard tabs", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[...BANKS, ...IGCSE_RELEASE_BANK_CATALOG]} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Cambridge IGCSE", "IB Diploma"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("#ib-diploma-panel")).toHaveAttribute("hidden");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("#cambridge-igcse-panel")).toHaveAttribute("hidden");
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("leads with the By topic / Full papers switch and remembers it", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} />);
    const topic = screen.getByRole("radio", { name: "Practice by topic" });
    const papers = screen.getByRole("radio", { name: "Full past papers" });
    expect(topic).toHaveAttribute("aria-checked", "true");
    expect(topic.compareDocumentPosition(screen.getAllByRole("tab")[0])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(papers);
    expect(papers).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector("[data-mode]")).toHaveAttribute("data-mode", "papers");
    expect(window.localStorage.getItem(PRACTICE_MODE_KEY)).toBe("papers");
    expect(screen.getByRole("radiogroup", { name: "How do you want to practise?" })).toHaveAttribute("data-active", "1");

    // Arrow keys move the choice, like any radio group.
    fireEvent.keyDown(papers, { key: "ArrowLeft" });
    expect(topic).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(topic);
  });

  it("remembers the qualification a visitor picked, over the one their plan suggests", async () => {
    window.localStorage.setItem(QUALIFICATION_KEY, "igcse");
    window.localStorage.setItem(PRACTICE_MODE_KEY, "papers");
    const { container } = render(<DashboardContent authenticated accessibleBanks={["ib-hl"]} />);
    await waitFor(() => expect(container.querySelector("[data-mode]")).toHaveAttribute("data-mode", "papers"));
    expect(screen.getByRole("tab", { name: "Cambridge IGCSE" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));
    expect(window.localStorage.getItem(QUALIFICATION_KEY)).toBe("ib");
  });

  it("stores the plan's qualification so the landing page opens on it too", async () => {
    render(<DashboardContent authenticated accessibleBanks={["ib-hl", "ib-sl"]} />);
    await waitFor(() => expect(window.localStorage.getItem(QUALIFICATION_KEY)).toBe("ib"));
  });

  it("only exposes qualifications that have available banks", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={BANKS.filter((bank) => bank.qualification === "Cambridge IGCSE")} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Cambridge IGCSE"]);
    expect(screen.queryByRole("tab", { name: "IB Diploma" })).not.toBeInTheDocument();
  });

  it("handles an empty catalog without empty tabs or panels", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[]} />);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(screen.getByText(/no question banks are available right now/i)).toBeInTheDocument();
  });
});
