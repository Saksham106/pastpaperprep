"use client";

import Link from "next/link";
import { useState } from "react";

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

export function CheckoutButton({ interval, navigate = defaultNavigate }: { interval: BillingInterval; navigate?: Navigate }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  async function start() {
    setPending(true);
    setError("");
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
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
        {pending ? "Opening checkout…" : `Choose ${interval}`}
      </button>
      {needsLogin ? <Link href="/login?next=/pricing">Sign in to continue</Link> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function CheckoutButtons({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  return (
    <div className="billing-options-actions">
      <CheckoutButton interval="annual" navigate={navigate} />
      <CheckoutButton interval="monthly" navigate={navigate} />
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
