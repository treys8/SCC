import { redirect } from "next/navigation";

/**
 * The facility console moved into the unified staff console. Keep this route as
 * a redirect so old links/bookmarks (and the realtime widgets that still import
 * facility/actions.ts) keep working. Conditions live at /manage/conditions; the
 * lunch buffet moved to /manage/dining.
 */
export default function FacilityPage() {
  redirect("/manage/conditions");
}
