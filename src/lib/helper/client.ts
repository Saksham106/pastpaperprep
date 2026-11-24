// Browser side of the study helper: photo resizing and the streaming request.
import { HELPER_IMAGE_MAX_EDGE, type HelperMode } from "@/lib/helper/config";
import type { HelperTurn } from "@/lib/helper/request";

export class HelperRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Downscales a photo to a JPEG data URL (longest edge HELPER_IMAGE_MAX_EDGE), so uploads stay small on mobile data. */
export async function photoToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new HelperRequestError("Choose a photo (JPEG, PNG or HEIC).", 400);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new HelperRequestError("That photo couldn't be read. Try another one.", 400);
  const scale = Math.min(1, HELPER_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new HelperRequestError("That photo couldn't be read. Try another one.", 400);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export type HelperStreamResult = { remaining: number | null; limit: number | null };

/** Sends one message and calls onText with the growing reply. */
export async function streamHelperReply(
  input: { bank: string; questionId: string; mode: HelperMode; messages: HelperTurn[]; image?: string },
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<HelperStreamResult> {
  const response = await fetch("/api/helper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    let message = "The helper couldn't answer. Try again.";
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new HelperRequestError(message, response.status);
  }
  const remainingHeader = response.headers.get("X-Helper-Remaining");
  const limitHeader = response.headers.get("X-Helper-Limit");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  onText(text);
  return {
    remaining: remainingHeader === null ? null : Number(remainingHeader),
    limit: limitHeader === null ? null : Number(limitHeader),
  };
}
