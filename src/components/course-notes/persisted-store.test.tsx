import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LEVEL_KEY, LevelSwitch, useNotesLevel } from "./LevelSwitch";
import { PROGRESS_KEY, useNotesProgress } from "./useNotesProgress";
import { resetPersistedStoresForTests } from "./persisted-store";

vi.mock("./track", () => ({ trackLevelSwitch: vi.fn() }));

function Harness() {
  const [level, setLevel] = useNotesLevel();
  const { understood, mark, unmark } = useNotesProgress();
  return (
    <div>
      <LevelSwitch level={level} onChange={setLevel} />
      <output data-testid="level">{level}</output>
      <output data-testid="understood">{[...understood].join(",")}</output>
      <button onClick={() => mark("1.1")}>mark</button>
      <button onClick={() => unmark("1.1")}>unmark</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const blockWrites = () =>
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  });

describe("level and progress controls", () => {
  it("persist and update the UI on the normal path", () => {
    render(<Harness />);
    expect(screen.getByTestId("level").textContent).toBe("HL");
    fireEvent.click(screen.getByRole("button", { name: "SL" }));
    fireEvent.click(screen.getByRole("button", { name: "mark" }));
    expect(screen.getByTestId("level").textContent).toBe("SL");
    expect(screen.getByTestId("understood").textContent).toBe("1.1");
    expect(window.localStorage.getItem(LEVEL_KEY)).toBe("SL");
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]")).toEqual(["1.1"]);
    fireEvent.click(screen.getByRole("button", { name: "unmark" }));
    expect(screen.getByTestId("understood").textContent).toBe("");
  });

  it("still switch level and mark understood when storage writes throw QuotaExceededError", () => {
    blockWrites();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "SL" }));
    expect(screen.getByTestId("level").textContent).toBe("SL");
    expect(screen.getByRole("button", { name: "SL" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "mark" }));
    expect(screen.getByTestId("understood").textContent).toBe("1.1");
    fireEvent.click(screen.getByRole("button", { name: "unmark" }));
    expect(screen.getByTestId("understood").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "HL" }));
    expect(screen.getByTestId("level").textContent).toBe("HL");
    expect(window.localStorage.getItem(LEVEL_KEY)).toBeNull();
  });

  it("keep the choice across remounts in the same tab when storage is blocked", () => {
    blockWrites();
    const first = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "SL" }));
    fireEvent.click(screen.getByRole("button", { name: "mark" }));
    first.unmount();
    render(<Harness />);
    expect(screen.getByTestId("level").textContent).toBe("SL");
    expect(screen.getByTestId("understood").textContent).toBe("1.1");
  });

  it("work when storage reads throw too", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    blockWrites();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "SL" }));
    expect(screen.getByTestId("level").textContent).toBe("SL");
  });

  it("follow another tab through the storage event", () => {
    render(<Harness />);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: LEVEL_KEY, newValue: "SL" }));
      window.dispatchEvent(new StorageEvent("storage", { key: PROGRESS_KEY, newValue: JSON.stringify(["2.5"]) }));
    });
    expect(screen.getByTestId("level").textContent).toBe("SL");
    expect(screen.getByTestId("understood").textContent).toBe("2.5");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.getByTestId("level").textContent).toBe("HL");
    expect(screen.getByTestId("understood").textContent).toBe("");
  });
});
