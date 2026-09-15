import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardContent } from "@/components/DashboardContent";
import { ECONOMICS_BANK_CATALOG, IGCSE_RELEASE_BANK_CATALOG, BANKS } from "@/lib/banks";

describe("DashboardContent", () => {
  it("puts included banks first and keeps account tools in one disclosure", () => {
    const { container } = render(<DashboardContent authenticated accessibleBanks={["ib-ai-hl"]} />);
    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));

    expect(screen.getByRole("heading", { name: /your study desk/i })).toBeInTheDocument();
    expect(screen.getByText(/account & settings/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my account/i })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: /password settings/i })).toHaveAttribute("href", "/account/password");
    expect(screen.getByRole("link", { name: /manage plan/i })).toHaveAttribute("href", "/pricing");
    expect(container.querySelector("#ib-diploma-panel .dashboard-bank-card")).toHaveAttribute("aria-label", "Open IB Math AI HL");
    expect(screen.getByRole("link", { name: /open ib math ai hl/i })).toHaveAttribute("href", "/banks/ib-ai-hl");
  });

  it("sends free visitors straight to free questions and keeps upgrade discovery visible", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    expect(screen.getByRole("link", { name: /start free.*mathematics 0580/i })).toHaveAttribute("href", "/banks/igcse?free=1");
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("groups banks by the courses students recognise and makes each complete card the link", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    expect(screen.getByRole("heading", { name: "Mathematics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));
    expect(screen.getByRole("heading", { name: "Analysis and Approaches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applications and Interpretation" })).toBeInTheDocument();
    expect(container.querySelector(".dashboard-study-desk")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Cambridge IGCSE" }));
    const cardLink = screen.getByRole("link", { name: /start free.*mathematics 0580/i });
    expect(cardLink).toHaveClass("dashboard-bank-card");
    expect(cardLink).toContainElement(screen.getByRole("heading", { name: "0580" }));
    expect(container.querySelector(".dashboard-upgrade-strip")?.compareDocumentPosition(container.querySelector(".dashboard-bank-groups")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps each bank card concise without repeating its course identity", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    const card = screen.getByRole("link", { name: /start free.*mathematics 0580/i });
    expect(card.textContent?.match(/0580/g)).toHaveLength(1);
    expect(card).not.toHaveTextContent(/build confidence across core and extended/i);
    expect(card).not.toHaveTextContent(/mathematics 0580.*igcse 0580/i);
  });

  it("uses subject groups inside the Cambridge tab without repeating the qualification", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    expect(container.querySelector("#cambridge-igcse-panel")).not.toHaveTextContent("Cambridge IGCSE");
    expect(container.querySelectorAll("#cambridge-igcse-panel .dashboard-bank-family")).toHaveLength(2);
    expect(container.querySelector("#cambridge-igcse-panel .dashboard-bank-groups"))
      .toHaveClass("dashboard-cambridge-subject-grid");
  });

  it("keeps every IB card independently identifiable", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "IB Diploma" }));

    expect(screen.getByRole("heading", { name: "Maths AA HL" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maths AA SL" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maths AI HL" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maths AI SL" })).toBeInTheDocument();
    expect(container.querySelectorAll("#ib-diploma-panel [data-course-icon]")).toHaveLength(5);
    expect(container.querySelectorAll("#ib-diploma-panel .dashboard-bank-card [data-course-icon]")).toHaveLength(0);
    expect(container.querySelector(".dashboard-bank-family-ib-chemistry > header [data-course-icon=chemistry]")).not.toBeNull();
    expect(container.querySelector(".dashboard-bank-family-ib-physics > header [data-course-icon=physics]")).not.toBeNull();
    expect(container.querySelector(".dashboard-bank-family-ib-biology > header [data-course-icon=biology]")).not.toBeNull();
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
    expect(screen.getByRole("link", { name: "Open IB Economics HL" })).toHaveAttribute("href", "/banks/ib-economics-hl");
    expect(screen.getByRole("link", { name: "Open IB Economics SL" })).toHaveAttribute("href", "/banks/ib-economics-sl");
  });

  it("separates Cambridge IGCSE and IB Diploma banks behind keyboard tabs", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[...BANKS, ...IGCSE_RELEASE_BANK_CATALOG]} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Cambridge IGCSE", "IB Diploma"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "0610" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Maths AA HL" })).not.toBeInTheDocument();

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Maths AA HL" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "0610" })).not.toBeInTheDocument();
    expect(document.querySelector("#cambridge-igcse-panel")).toHaveAttribute("hidden");
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("renders a non-empty title for every available bank", () => {
    const { container } = render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[...BANKS, ...IGCSE_RELEASE_BANK_CATALOG]} />);
    expect([...container.querySelectorAll(".dashboard-bank-card h3")].every((heading) => heading.textContent?.trim())).toBe(true);
    expect(screen.getByRole("heading", { name: "0455" })).toBeInTheDocument();
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
