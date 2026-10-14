import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { ScorePage } from "@/components/panel/ScorePage";

export const metadata: Metadata = { title: "Score sheet", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER") redirect(homeFor(user.role));
  return <ScorePage user={user} id={(await params).id} base="/review" />;
}
