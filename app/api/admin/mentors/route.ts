import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { serverError } from "@/lib/http";
import { listMentors } from "@/lib/services/mentorService";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiPermission("mentors:review");
  if ("error" in auth) return auth.error;
  try {
    // List view returns only what a table needs. Full detail is loaded server-side on the detail page.
    const rows = (await listMentors()).map((m) => ({ mentorId: m.mentorId, fullName: m.fullName, organization: m.organization, profession: m.profession, state: m.state, yearsExperience: m.yearsExperience, expertise: m.expertise, availability: m.availability, status: m.status, submittedAt: m.submittedAt }));
    return NextResponse.json({ count: rows.length, mentors: rows });
  } catch (e) { return serverError(e); }
}
