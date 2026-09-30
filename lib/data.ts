import "server-only";
import type { Application } from "@/types/application";
import { getRepository } from "@/lib/repository";
import { demoApplications } from "@/lib/demo";

/** Demo data is impossible in production, regardless of env. */
export const isDemoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

export async function loadApplications(): Promise<{ applications: Application[]; demo: boolean }> {
  if (isDemoMode()) return { applications: demoApplications(), demo: true };
  return { applications: await getRepository().getApplications(), demo: false };
}

export async function loadApplication(id: string): Promise<{ application: Application | null; demo: boolean }> {
  if (isDemoMode()) return { application: demoApplications().find((a) => a.applicationId === id) ?? null, demo: true };
  return { application: await getRepository().getApplicationById(id), demo: false };
}
