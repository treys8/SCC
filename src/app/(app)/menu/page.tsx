import { redirect } from "next/navigation";

/**
 * Menus moved onto the staff-editable Dining page (PDFs now live in the document
 * library). Kept as a permanent redirect so old links and bookmarks still land.
 */
export default function MenuPage() {
  redirect("/dining");
}
