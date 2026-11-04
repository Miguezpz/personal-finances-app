/**
 * Brief content fade on every navigation inside the app (spec 003, FR-028). A template remounts per route (unlike
 * the layout), so the CSS animation replays; under reduced motion it collapses to nothing (globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-content-in">{children}</div>;
}
