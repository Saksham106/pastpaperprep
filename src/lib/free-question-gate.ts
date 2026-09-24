export const ANONYMOUS_FREE_QUESTION_LIMIT = 20;

export type FreeQuestionGateInput = {
  resolved: boolean;
  authenticated: boolean;
  bankAccess: boolean;
  freeOnly: boolean;
  freeQuestionCount: number;
};

export function getFreeQuestionGate(input: FreeQuestionGateInput) {
  const shouldCap = !input.authenticated
    && !input.bankAccess
    && input.freeQuestionCount > ANONYMOUS_FREE_QUESTION_LIMIT;
  const active = input.resolved && shouldCap;
  const visibleCount = shouldCap ? ANONYMOUS_FREE_QUESTION_LIMIT : input.freeQuestionCount;
  return {
    active,
    visibleCount,
    remainingCount: active ? input.freeQuestionCount - visibleCount : 0,
  };
}
