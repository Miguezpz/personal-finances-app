import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered trees between tests (no globals mode, so RTL can't register this itself).
afterEach(() => {
  cleanup();
});

/**
 * Tests never reach the internet: only local services (Supabase on localhost) are allowed. A test
 * that needs an external API (e.g. exchange rates) must stub `fetch` explicitly; anything else fails
 * loudly instead of silently depending on the network.
 */
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return realFetch(input, init);
  return Promise.reject(
    new TypeError(`Network access to ${url.hostname} is disabled in tests; stub fetch.`),
  );
};
