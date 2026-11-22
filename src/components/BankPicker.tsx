"use client";

import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { bankBoards, bankMatchesQuery, boardQualifiedName, type BankBoard } from "@/lib/bank-groups";
import type { QualificationId } from "@/lib/qualifications";
import { rememberBoard, useRememberedBoard } from "@/lib/remembered-board";

export type PickerBank = { slug: string; name: string; board: QualificationId; subject?: string };

/**
 * "Choose your banks": board tabs (IGCSE · A Level · IB, every board one tap away), a search across all boards, and,
 * for multi-bank plans, a tray of the chosen banks that stays visible with the picker closed. Every board's options
 * stay mounted (inactive tabs are hidden with CSS), so a pick on one tab survives switching to another.
 */
export function BankPicker({
  banks,
  mode,
  selected,
  onPick,
  title,
  summaryValue,
  idPrefix,
  inputName,
  isDisabled,
  rowTag,
  disabled = false,
  detailsRef,
  radioChecked,
}: {
  banks: readonly PickerBank[];
  mode: "single" | "builder";
  /** Picked banks: chips, tab counts and (unless radioChecked is given) checked inputs. */
  selected: readonly string[];
  /** Toggle (builder) or choose (single). The trigger is the input or chip that asked. */
  onPick: (slug: string, trigger: HTMLElement) => void;
  title: string;
  summaryValue: string;
  idPrefix: string;
  inputName: (slug: string) => string;
  isDisabled?: (slug: string) => boolean;
  rowTag?: (slug: string) => ReactNode;
  disabled?: boolean;
  detailsRef?: Ref<HTMLDetailsElement>;
  /** One Bank radios may show no pick even when `selected` holds the current bank. */
  radioChecked?: (slug: string) => boolean;
}) {
  const boards = bankBoards(banks, (bank) => bank.board);
  const rememberedBoard = useRememberedBoard();
  const searchId = useId();
  const [chosenBoard, setChosenBoard] = useState<QualificationId | null>(null);
  // Open on the board that already holds a pick (a bank's upgrade link, an existing plan), else the remembered board.
  const [startBoard] = useState(() => banks.find((bank) => selected.includes(bank.slug))?.board ?? null);
  const [query, setQuery] = useState("");
  const tabRefs = useRef(new Map<QualificationId, HTMLButtonElement>());
  const has = (board: QualificationId | null): board is QualificationId => Boolean(board && boards.some((group) => group.board === board));
  const activeBoard = [chosenBoard, startBoard, rememberedBoard].find(has) ?? boards[0]?.board;
  const searching = query.trim().length > 0;
  const results = searching ? boards.map((group) => ({ ...group, banks: group.banks.filter((bank) => bankMatchesQuery(query, bank)) })).filter((group) => group.banks.length) : [];
  const picked = selected.map((slug) => banks.find((bank) => bank.slug === slug)).filter((bank): bank is PickerBank => Boolean(bank));
  const isChecked = (slug: string) => radioChecked ? radioChecked(slug) : selected.includes(slug);

  function chooseBoard(board: QualificationId) {
    setChosenBoard(board);
    rememberBoard(board);
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % boards.length
      : event.key === "ArrowLeft" ? (index - 1 + boards.length) % boards.length
        : event.key === "Home" ? 0 : event.key === "End" ? boards.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    chooseBoard(boards[next].board);
    tabRefs.current.get(boards[next].board)?.focus();
  }

  const options = (group: BankBoard<PickerBank>) => (
    <div className="bank-picker-options">
      {group.banks.map((bank) => (
        <label data-bank-id={bank.slug} key={bank.slug}>
          <input
            type={mode === "single" ? "radio" : "checkbox"}
            name={inputName(bank.slug)}
            checked={isChecked(bank.slug)}
            disabled={isDisabled?.(bank.slug)}
            onChange={(event) => onPick(bank.slug, event.currentTarget)}
          />
          <span>{bank.name}</span>
          {rowTag?.(bank.slug)}
        </label>
      ))}
    </div>
  );

  return (
    <>
      <details ref={detailsRef} className="custom-bank-disclosure">
        <summary>
          <span>{title}</span>
          <span className="custom-bank-disclosure-value">{summaryValue}</span>
          <CaretDown aria-hidden="true" weight="bold" />
        </summary>
        <fieldset className="custom-bank-picker" disabled={disabled}>
          <legend className="sr-only">{mode === "single" ? "Choose one question bank" : "Choose the banks you need"}</legend>
          <div className="bank-picker-head">
            <label className="bank-picker-search" htmlFor={searchId}>
              <MagnifyingGlass aria-hidden="true" weight="bold" />
              <span className="sr-only">Search banks</span>
              <input
                id={searchId}
                type="search"
                placeholder="Search subject or code"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); } }}
              />
            </label>
            {!searching && boards.length > 1 ? (
              <div className="bank-board-tabs" role="tablist" aria-label="Exam board">
                {boards.map((group, index) => {
                  const count = group.banks.filter((bank) => selected.includes(bank.slug)).length;
                  const active = group.board === activeBoard;
                  return (
                    <button
                      key={group.board}
                      ref={(node) => { if (node) tabRefs.current.set(group.board, node); else tabRefs.current.delete(group.board); }}
                      id={`${idPrefix}-tab-${group.board}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`${idPrefix}-panel-${group.board}`}
                      aria-label={count ? `${group.shortLabel}, ${count} selected` : undefined}
                      tabIndex={active ? 0 : -1}
                      onClick={() => chooseBoard(group.board)}
                      onKeyDown={(event) => moveTab(event, index)}
                    >
                      {group.shortLabel}
                      {count ? <span className="bank-board-tab-count" aria-hidden="true">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {searching ? (
            <div className="bank-search-results" aria-live="polite">
              {results.length ? results.map((group) => (
                <section key={group.board} aria-label={group.label} data-board={group.board}>
                  <h3>{group.label}</h3>
                  {options(group)}
                </section>
              )) : <p className="bank-search-empty">No bank matches “{query.trim()}”.</p>}
            </div>
          ) : boards.map((group) => (
            <div
              key={group.board}
              className="bank-board-panel"
              id={`${idPrefix}-panel-${group.board}`}
              data-board={group.board}
              data-active={group.board === activeBoard ? "true" : "false"}
              {...(boards.length > 1 ? { role: "tabpanel", "aria-labelledby": `${idPrefix}-tab-${group.board}` } : { "aria-label": group.label })}
            >
              {options(group)}
            </div>
          ))}
        </fieldset>
      </details>
      {mode === "builder" && picked.length ? (
        <ul className="bank-chip-tray" aria-label="Selected banks">
          {picked.map((bank) => {
            const name = boardQualifiedName(bank.name, bank.board);
            return (
              <li key={bank.slug}>
                <button type="button" className="bank-chip" aria-label={`Remove ${name}`} disabled={disabled || isDisabled?.(bank.slug)} onClick={(event) => onPick(bank.slug, event.currentTarget)}>
                  <span>{name}</span>
                  <X aria-hidden="true" weight="bold" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
