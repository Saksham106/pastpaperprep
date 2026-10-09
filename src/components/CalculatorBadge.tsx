import { calculatorBadgeText } from "@/lib/calculator-policy.mjs";

export function CalculatorBadge({ value }: { value: boolean | null | undefined }) {
  const text = calculatorBadgeText(value);
  if (!text) return null;
  return <span className={`calculator-badge${value === false ? " is-none" : ""}`}>{text}</span>;
}
