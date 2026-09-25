import type { AccountPlanTarget } from "@/lib/account-plan-target";

export type ScheduleItem = { price: string; quantity: number };
export type SchedulePhase = { start_date: number | "now"; end_date?: number; items: ScheduleItem[]; metadata: Record<string, string> };

export function buildAccountPlanSchedulePhases(args: {
  currentStart: number; currentEnd: number; currentPriceId: string; currentQuantity: number;
  currentMetadata: Record<string, string>; target: AccountPlanTarget; targetMetadata: Record<string, string>;
}): [SchedulePhase, SchedulePhase] {
  const { currentStart, currentEnd, currentPriceId, currentQuantity, currentMetadata, target, targetMetadata } = args;
  if (!Number.isSafeInteger(currentStart) || !Number.isSafeInteger(currentEnd) || currentStart <= 0 || currentEnd <= currentStart) throw new Error("Invalid subscription period");
  if (!currentPriceId || !Number.isSafeInteger(currentQuantity) || currentQuantity < 1 || !target.priceId || !Number.isSafeInteger(target.quantity) || target.quantity < 1) throw new Error("Invalid schedule item");
  return [
    { start_date: currentStart, end_date: currentEnd, items: [{ price: currentPriceId, quantity: currentQuantity }], metadata: { ...currentMetadata } },
    { start_date: currentEnd, items: [{ price: target.priceId, quantity: target.quantity }], metadata: { ...targetMetadata } },
  ];
}
