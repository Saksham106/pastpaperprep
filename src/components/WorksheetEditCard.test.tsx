import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorksheetEditCard } from "./WorksheetEditCard";

describe("WorksheetEditCard", () => {
  it("keeps the last question rather than stranding an invalid empty worksheet", () => {
    const remove = vi.fn();
    render(<WorksheetEditCard title="Revision" ids={["ib-sl-2019-m-1"]} content="questions" adding={false} busy={false} dirty={false} status="" onTitle={vi.fn()} onContent={vi.fn()} onMove={vi.fn()} onRemove={remove} onAdd={vi.fn()} onDoneAdding={vi.fn()} onSave={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Remove question ib-sl-2019-m-1" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(remove).not.toHaveBeenCalled();
  });
});
