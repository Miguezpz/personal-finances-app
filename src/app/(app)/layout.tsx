import { AppShell } from "@/components/layout/AppShell";

/** Authenticated (or demo) area (T053). Proxy redirects anonymous visitors to `/`. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
