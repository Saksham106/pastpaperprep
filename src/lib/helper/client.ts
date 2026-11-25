// Browser side of the study helper: photo resizing and request errors. The stream itself is site-events.ts.
import { HELPER_IMAGE_MAX_EDGE } from "@/lib/helper/config";

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
