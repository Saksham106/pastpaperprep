import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorksheetList } from "@/components/WorksheetList";
import { DashboardContent } from "@/components/DashboardContent";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function enableDialog() {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector<HTMLButtonElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event("close")); };
}
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
    expect(page).toContain('href="/dashboard" aria-label="Back to dashboard"');
    expect(page.indexOf('Back to dashboard')).toBeLessThan(page.indexOf('<h1>My worksheets</h1>'));
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

  it("uses a styled modal: cancel and Escape do not delete, and confirmation deletes once", async () => {
    enableDialog();
    const confirm = vi.spyOn(window, "confirm");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ worksheets: items })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WorksheetList />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Algebra" }));
    expect(screen.getByRole("dialog", { name: "Delete “Algebra”?" })).toHaveTextContent(/permanently deleted/i);
    expect(screen.getByRole("button", { name: "Keep worksheet" })).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep worksheet" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Algebra" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Delete Algebra" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete worksheet" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Algebra" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/worksheets/w-1", { method: "DELETE" });
  });

  it("keeps the deletion dialog open when the API fails and reports the error", async () => {
    enableDialog();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ worksheets: items })).mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WorksheetList />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Algebra" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete worksheet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not delete/i);
    expect(screen.getByRole("dialog", { name: "Delete “Algebra”?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Algebra" })).toBeInTheDocument();
  });

  it("ignores a second delete activation before the busy state renders", async () => {
    enableDialog();
    let finishDelete!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ worksheets: items }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishDelete = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WorksheetList />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Algebra" }));
    const confirm = screen.getByRole("button", { name: "Delete worksheet" });
    await act(async () => { confirm.click(); confirm.click(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => finishDelete(new Response(null, { status: 204 })));
    expect(screen.queryByRole("heading", { name: "Algebra" })).not.toBeInTheDocument();
  });

  it("presents load failures accessibly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<WorksheetList />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
