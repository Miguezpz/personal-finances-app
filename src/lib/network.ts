/** true when the browser knows it has no connection (never true on the server). */
export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
