import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { clearMemberCaches } from "@/lib/member-session-cache";

afterEach(cleanup);
// Per-tab member caches are module state; a request finishing after a test must not leak into the next.
beforeEach(() => clearMemberCaches());
afterEach(() => clearMemberCaches());
