import { redirect } from "next/navigation";

/** Legacy /base route. Redirects to /dashboard. */
export default function LegacyBasePage() {
  redirect("/dashboard");
}
