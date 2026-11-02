import { redirect } from "next/navigation";
import { Landing } from "@/features/auth/Landing";
import { env } from "@/lib/env";

/**
 * Landing (T052): sign-in form + "Explore Demo / Recruiters". The demo deployment has no
 * sign-in at all and goes straight to the dashboard (NEXT_PUBLIC_DEMO_MODE is a build-time
 * constant, so this redirect is static).
 */
export default function Home() {
  if (env.isDemo) redirect("/dashboard");
  return <Landing demoUrl={env.demoUrl} />;
}
