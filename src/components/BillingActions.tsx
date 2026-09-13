"use client";

import Link from "next/link";
import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProductId } from "@/lib/access";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";

type Navigate = (url: string) => void;
type BillingError = { error?: unknown };

function defaultNavigate(url: string) {
  window.location.assign(url);
}

function trustedStripeUrl(value: unknown, host: "checkout.stripe.com" | "billing.stripe.com"): string {
  if (typeof value !== "string") throw new Error("Invalid billing destination");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== host) throw new Error("Invalid billing destination");
  return url.toString();
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

type BillingInterval = "monthly" | "annual";

type BankGroup = {
  label: string;
  banks: readonly Bank[];
};

function getBankGroups(banks: readonly Bank[]): readonly BankGroup[] {
  return [
    { label: "Cambridge", banks: banks.filter((bank) => bank.qualification === "Cambridge IGCSE") },
    { label: "IB Mathematics", banks: banks.filter((bank) => bank.qualification === "International Baccalaureate" && bank.subject.startsWith("Mathematics")) },
    { label: "IB Sciences", banks: banks.filter((bank) => !bank.subject.startsWith("Mathematics") && bank.qualification !== "Cambridge IGCSE") },
  ];
}

const BANK_PRODUCT_BY_SLUG: Partial<Record<BankSlug, ProductId>> = {
  igcse: "bank_igcse",
  "igcse-additional": "bank_igcse_additional",
  "ib-hl": "bank_ib_hl",
  "ib-sl": "bank_ib_sl",
  "ib-ai-hl": "bank_ib_ai_hl",
  "ib-ai-sl": "bank_ib_ai_sl",
  "ib-chemistry-hl": "bank_ib_chemistry_hl",
  "ib-chemistry-sl": "bank_ib_chemistry_sl",
  "ib-physics-hl": "bank_ib_physics_hl",
  "ib-physics-sl": "bank_ib_physics_sl",
  "ib-biology-hl": "bank_ib_biology_hl",
  "ib-biology-sl": "bank_ib_biology_sl",
  "igcse-biology-0610": "bank_igcse_biology_0610",
  "igcse-economics-0455": "bank_igcse_economics_0455",
};

function PlanSelector({ options, value, onChange }: {
  options: readonly { productId: ProductId; label: string }[];
  value: ProductId;
  onChange: (productId: ProductId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<ProductId, HTMLButtonElement>());
  const listboxId = useId();
  const labelId = useId();
  const selected = options.find((option) => option.productId === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    optionRefs.current.get(value)?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open, value]);

  function choose(productId: ProductId) {
    onChange(productId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveOption(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[index].productId);
      return;
    }
    const destination = event.key === "Home" ? 0
      : event.key === "End" ? options.length - 1
        : event.key === "ArrowDown" ? (index + 1) % options.length
          : event.key === "ArrowUp" ? (index - 1 + options.length) % options.length
            : -1;
    if (destination >= 0) {
      event.preventDefault();
      optionRefs.current.get(options[destination].productId)?.focus();
    }
  }

  return (
    <div ref={rootRef} className="plan-selector">
      <span id={labelId} className="plan-selector-label">Choose access</span>
      <button
        ref={triggerRef}
        className="plan-select-trigger"
        type="button"
        aria-label={`Choose access: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected.label}</span>
        <CaretDown aria-hidden="true" weight="bold" />
      </button>
      {open ? (
        <div id={listboxId} className="plan-select-menu" role="listbox" aria-labelledby={labelId}>
          {options.map((option, index) => (
            <button
              key={option.productId}
              ref={(element) => {
                if (element) optionRefs.current.set(option.productId, element);
                else optionRefs.current.delete(option.productId);
              }}
              className="plan-select-option"
              type="button"
              role="option"
              aria-selected={option.productId === value}
              onClick={() => choose(option.productId)}
              onKeyDown={(event) => moveOption(event, index)}
            >
              <span>{option.label}</span>
              {option.productId === value ? <Check aria-hidden="true" weight="bold" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CheckoutButton({
  interval,
  productId,
  selectedBankIds,
  navigate = defaultNavigate,
  pending: sharedPending,
  onPendingChange,
  label,
}: {
  interval: BillingInterval;
  productId: ProductId;
  selectedBankIds?: readonly BankSlug[];
  navigate?: Navigate;
  pending?: boolean;
  onPendingChange?: (pending: boolean) => void;
  label?: string;
}) {
  const [localPending, setLocalPending] = useState(false);
  const pending = sharedPending ?? localPending;
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const customBankQuery = selectedBankIds?.length
    ? `&banks=${encodeURIComponent([...selectedBankIds].sort().join(","))}`
    : "";

  function setPending(value: boolean) {
    setLocalPending(value);
    onPendingChange?.(value);
  }

  async function start() {
    if (pending) return;
    setPending(true);
    setError("");
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval, productId, ...(selectedBankIds ? { selectedBankIds } : {}) }),
      });
      const payload = await responsePayload(response);
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!response.ok) {
        const message = (payload as BillingError).error;
        throw new Error(typeof message === "string" ? message : "Checkout is temporarily unavailable");
      }
      navigate(trustedStripeUrl(payload.url, "checkout.stripe.com"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout is temporarily unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="billing-actions">
      <button className={`button ${interval === "annual" ? "primary" : "secondary"}`} type="button" disabled={pending} onClick={start}>
        {pending ? "Opening checkout…" : label ?? `Choose ${interval}`}
      </button>
      {needsLogin ? (
        <Link href={`/login?next=${encodeURIComponent(`/pricing?interval=${interval}&product=${productId}${customBankQuery}`)}`}>
          Sign in to continue
        </Link>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function CheckoutButtons({ productId, navigate = defaultNavigate }: { productId: ProductId; navigate?: Navigate }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="billing-options-actions">
      <CheckoutButton interval="annual" productId={productId} navigate={navigate} pending={pending} onPendingChange={setPending} />
      <CheckoutButton interval="monthly" productId={productId} navigate={navigate} pending={pending} onPendingChange={setPending} />
    </div>
  );
}

export function PlanCheckout({
  options,
  interval,
  authenticated,
  hasPaidAccess,
  initialProductId,
  ctaLabel = "Continue to checkout",
}: {
  options: readonly { productId: ProductId; label: string }[];
  interval: BillingInterval;
  authenticated: boolean;
  hasPaidAccess: boolean;
  initialProductId?: ProductId;
  ctaLabel?: string;
}) {
  const availableInitial = initialProductId && options.some((option) => option.productId === initialProductId) ? initialProductId : options[0].productId;
  const [productId, setProductId] = useState<ProductId>(availableInitial);
  if (hasPaidAccess) return null;
  const pricingReturn = `/pricing?interval=${interval}&product=${productId}`;
  return (
    <div className="plan-checkout">
      {options.length > 1 ? (
        <PlanSelector options={options} value={productId} onChange={setProductId} />
      ) : null}
      {authenticated
        ? <CheckoutButton interval={interval} productId={productId} />
        : <Link className="button primary" href={`/login?next=${encodeURIComponent(pricingReturn)}`}>{ctaLabel}</Link>}
    </div>
  );
}

export function CustomBundleCheckout({
  mode,
  interval,
  authenticated,
  hasPaidAccess,
  initialBankIds = [],
  availableBanks = BANKS,
  onSelectionChange,
  ctaLabel = "Continue to checkout",
}: {
  mode: "single" | "builder";
  interval: BillingInterval;
  authenticated: boolean;
  hasPaidAccess: boolean;
  initialBankIds?: readonly BankSlug[];
  availableBanks?: readonly Bank[];
  onSelectionChange?: (selectedBankIds: readonly BankSlug[]) => void;
  ctaLabel?: string;
}) {
  const selectableBanks = mode === "single"
    ? availableBanks.filter((bank) => Boolean(BANK_PRODUCT_BY_SLUG[bank.slug]))
    : availableBanks;
  const [selectedBankIds, setSelectedBankIds] = useState<BankSlug[]>(() => {
    const initial = [...initialBankIds];
    const initialSingleBank = initial[0];
    return mode === "single" && initialSingleBank && BANK_PRODUCT_BY_SLUG[initialSingleBank]
      ? [initialSingleBank]
      : mode === "builder" ? initial : [];
  });
  useEffect(() => {
    onSelectionChange?.(selectedBankIds);
  }, [onSelectionChange, selectedBankIds]);
  if (hasPaidAccess) return null;
  const quantity = selectedBankIds.length;
  const allAccess = quantity >= 6;

  const bankSelection = [...selectedBankIds].sort();
  const pricingReturn = `/pricing?interval=${interval}&banks=${encodeURIComponent(bankSelection.join(","))}`;
  const selectedBankName = availableBanks.find((bank) => bank.slug === selectedBankIds[0])?.shortName;
  const singleProductId = selectedBankIds[0] ? BANK_PRODUCT_BY_SLUG[selectedBankIds[0]] : undefined;
  const canCheckout = mode === "single" ? quantity === 1 && Boolean(singleProductId) : quantity >= 2;
  const bankGroups = getBankGroups(selectableBanks);
  const selectionSummary = mode === "single"
    ? selectedBankName ?? "Choose a bank"
    : quantity === 0 ? "None selected" : `${quantity} selected`;

  function toggleBank(bankId: BankSlug) {
    setSelectedBankIds((current) => {
      if (mode === "single") return [bankId];
      return current.includes(bankId) ? current.filter((id) => id !== bankId) : [...current, bankId];
    });
  }

  const selectionNote = allAccess
    ? "Six or more banks automatically use All Access."
    : mode === "single" && quantity === 0
      ? "Select one bank to continue."
      : mode === "builder" && quantity === 0
        ? "Select at least two banks to continue."
        : mode === "builder" && quantity === 1
          ? "Select one more bank to continue."
          : null;

  return (
    <div className="plan-checkout custom-bundle-checkout">
      <details className="custom-bank-disclosure">
        <summary>
          <span>{mode === "single" ? "Choose question bank" : "Choose your banks"}</span>
          <span className="custom-bank-disclosure-value">{selectionSummary}</span>
          <CaretDown aria-hidden="true" weight="bold" />
        </summary>
        <fieldset className="custom-bank-picker">
          <legend className="sr-only">{mode === "single" ? "Choose one question bank" : "Choose the banks you need"}</legend>
          <div className="custom-bank-groups">
            {bankGroups.map((group) => (
              <section className="custom-bank-group" key={group.label} aria-labelledby={`bank-group-${mode}-${group.label.toLowerCase().replaceAll(" ", "-")}`}>
                <h3 id={`bank-group-${mode}-${group.label.toLowerCase().replaceAll(" ", "-")}`}>{group.label}</h3>
                <div className="custom-bank-group-options">
                  {group.banks.map((bank) => (
                    <label data-bank-id={bank.slug} key={bank.slug}>
                      <input
                        type={mode === "single" ? "radio" : "checkbox"}
                        name={mode === "single" ? "one-bank" : `custom-bank-${bank.slug}`}
                        checked={selectedBankIds.includes(bank.slug)}
                        onChange={() => toggleBank(bank.slug)}
                      />
                      <span>{bank.shortName}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </fieldset>
      </details>
      {selectionNote ? <p className="custom-bundle-selection-note">{selectionNote}</p> : null}
      {canCheckout ? <>
        {authenticated
          ? mode === "single"
            ? singleProductId ? <CheckoutButton interval={interval} productId={singleProductId} /> : null
            : <CheckoutButton interval={interval} productId="bundle_custom" selectedBankIds={bankSelection} label={ctaLabel} />
          : <Link className="button primary" href={`/login?next=${encodeURIComponent(pricingReturn)}`}>{ctaLabel}</Link>}
      </> : null}
    </div>
  );
}

export function PortalButton({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await responsePayload(response);
      if (!response.ok) {
        const message = (payload as BillingError).error;
        throw new Error(typeof message === "string" ? message : "Billing portal is temporarily unavailable");
      }
      navigate(trustedStripeUrl(payload.url, "billing.stripe.com"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing portal is temporarily unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="billing-actions compact">
      <button className="button secondary" type="button" disabled={pending} onClick={openPortal}>
        {pending ? "Opening portal…" : "Manage billing"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
