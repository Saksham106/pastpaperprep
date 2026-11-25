// Shared message shapes for Pepper's requests (parsed in pepper-request.ts).

export type HelperTurn = { role: "user" | "assistant"; text: string };
export type HelperImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
