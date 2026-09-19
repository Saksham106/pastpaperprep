/**
 * Micro-interaction feedback for buttons and dialogs, following three rules:
 * 1. Motion is optional — the message always arrives via text too.
 * 2. Animations run via `element.animate` so they resume from the current
 *    position instead of queueing or restarting.
 * 3. Reduced-motion users get the message without the movement.
 */

type AnimatableElement = Element & { animate: (frames: Keyframe[], options?: KeyframeAnimationOptions) => Animation };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

function animateIfAllowed(element: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!element || prefersReducedMotion()) return;
  if (typeof (element as AnimatableElement).animate !== "function") return;
  (element as AnimatableElement).animate(frames, options);
}

/** Horizontal shake: "that didn't work." Pair with a visible error message. */
export function shakeElement(element: Element | null) {
  animateIfAllowed(
    element,
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
  );
}

/** One soft ring expanding from the element: "that worked." */
export function pulseSuccess(element: Element | null) {
  animateIfAllowed(
    element,
    [{ boxShadow: "0 0 0 0 rgb(47 112 82 / .45)" }, { boxShadow: "0 0 0 12px rgb(47 112 82 / 0)" }],
    { duration: 600, easing: "ease-out" },
  );
}
