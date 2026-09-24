import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorksheetList } from "@/components/WorksheetList";
import { DashboardContent } from "@/components/DashboardContent";

afterEach(() => vi.restoreAllMocks());
const items = [{ id: "w-1", bank_slug: "igcse-0580", title: "Algebra", question_ids: ["q1", "q2"], content_mode: "both" as const, revision: 3, updated_at: "2026-09-23T12:00:00Z" }];

describe("WorksheetList", () => {
  it("does not show private worksheets on the public dashboard", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} availableBanks={[]} />);
    expect(screen.queryByRole("heading", { name: "My worksheets" })).not.toBeInTheDocument();
  });

  it("loads owned worksheets and opens the matching bank and worksheet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: items })));
    render(<WorksheetList />);
    const link = await screen.findByRole("link", { name: /Open Algebra/ });
    expect(link).toHaveAttribute("href", "/banks/igcse-0580?worksheet=w-1");
    expect(screen.getByText(/2\s+questions/)).toBeInTheDocument();
  });

  it("renames by PATCHing only the name and revision, including after access lapses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ worksheets: items }))
      .mockResolvedValueOnce(Response.json({ worksheet: { ...items[0], title: "Geometry", revision: 4 } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WorksheetList />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Algebra" }));
    fireEvent.change(screen.getByLabelText("Worksheet name"), { target: { value: "Geometry" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Geometry", revision: 3 }) });
    expect(await screen.findByText("Geometry")).toBeInTheDocument();
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
