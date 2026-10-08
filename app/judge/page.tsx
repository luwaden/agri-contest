import { requirePagePermission } from "@/lib/auth/server";
import { PanelHome } from "@/components/panel/PanelHome";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export default async function JudgePage() {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "JUDGE") redirect(homeFor(user.role));
  return <PanelHome user={user} />;
}
