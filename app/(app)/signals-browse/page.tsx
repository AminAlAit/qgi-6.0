import { redirect } from "next/navigation";

/** Legacy /signals-browse redirects to /signals (#4 rename) */
export default function LegacySignalsBrowse() {
  redirect("/signals");
}
