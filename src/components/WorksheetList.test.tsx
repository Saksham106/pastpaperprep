import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorksheetList } from "@/components/WorksheetList";
import { DashboardContent } from "@/components/DashboardContent";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => vi.restoreAllMocks());
const items = [{ id: "w-1", bank_slug: "igcse-0580", title: "Algebra", question_ids: ["q1", "q2"], content_mode: "both" as const, revision: 3, updated_at: "2026-09-23T12:00:00Z" }];

describe("WorksheetList", () => {
  it("links signed-in users to the separate worksheet library without embedding the list", () => {
    render(<DashboardContent authenticated accessibleBanks={[]} availableBanks={[]} />);
    expect(screen.getByRole("link", { name: /my worksheets/i })).toHaveAttribute("href", "/worksheets");
    expect(screen.queryByRole("heading", { name: "My worksheets" })).not.toBeInTheDocument();
  });

  it("keeps the worksheet library link private on the public dashboard", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[]} />);
    expect(screen.queryByRole("link", { name: /my worksheets/i })).not.toBeInTheDocument();
  });

  it("has one prominent page title rather than repeating My worksheets inside the list", () => {
    const page = readFileSync(join(process.cwd(), "src/app/worksheets/page.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(page).toContain('<h1>My worksheets</h1>');
    expect(page).toContain('title: "My worksheets"');
    expect(css).toMatch(/\.worksheet-library-header h1\s*\{[^}]*font:\s*800 clamp\(/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: [] })));
    render(<WorksheetList />);
    expect(screen.queryByRole("heading", { name: "My worksheets" })).not.toBeInTheDocument();
  });

  it("loads owned worksheets and opens the matching bank and worksheet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: items })));
    render(<WorksheetList />);
    const link = await screen.findByRole("link", { name: /Open Algebra/ });
    expect(link).toHaveAttribute("href", "/banks/igcse-0580?worksheet=w-1");
    expect(screen.getByText(/2\s+questions/)).toBeInTheDocument();
  });

  it("protects the library route with a server-side claims check", () => {
    const source = readFileSync(join(process.cwd(), "src/app/worksheets/page.tsx"), "utf8");
    expect(source).toContain("await supabase.auth.getClaims()");
    expect(source).toContain('redirect("/login?next=%2Fworksheets")');
  });

  it("uses full navigation for saved-set links so Next cannot drop the worksheet query", () => {
    const source = readFileSync(join(process.cwd(), "src/components/WorksheetList.tsx"), "utf8");
    expect(source).toContain('<a className="saved-worksheet-action saved-worksheet-action-open" aria-label={`Open ${item.title}`}');
    expect(source).toContain('&mode=edit');
  });

  it("offers accessible Open, Edit and Delete actions without Rename", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: items })));
    render(<WorksheetList />);
    await screen.findByRole("heading", { name: "Algebra" });
    expect(screen.getByRole("link", { name: "Open Algebra" })).toHaveAttribute("href", "/banks/igcse-0580?worksheet=w-1");
    expect(screen.getByRole("link", { name: "Edit Algebra" })).toHaveAttribute("href", "/banks/igcse-0580?worksheet=w-1&mode=edit");
    expect(screen.getByRole("button", { name: "Delete Algebra" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
  });

  it("deletes only after confirmation and presents load failures accessibly", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ worksheets: items }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WorksheetList />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Algebra" }));
    expect(confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<WorksheetList />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
