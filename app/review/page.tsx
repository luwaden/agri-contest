import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/server";
import { PanelHome } from "@/components/panel/PanelHome";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Reviewer portal", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function ReviewPage() {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER") redirect(homeFor(user.role));
  return <PanelHome user={user} />;
}
