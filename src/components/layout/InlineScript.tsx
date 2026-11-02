/**
 * Runs `html` synchronously while the browser parses the document (before first paint).
 * Pattern from Next's "Preventing flash before hydration": text/javascript on the server,
 * text/plain on the client so React doesn't warn about rendering a <script>.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
