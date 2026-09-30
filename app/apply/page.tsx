import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationForm } from "@/components/application/ApplicationForm";
import { ApplicationStatus } from "@/components/landing/ApplicationStatus";
import { LinkButton } from "@/components/ui/Button";
import { windowSummary } from "@/lib/window";
import { PROGRAMME } from "@/config/programme";
import { FieldScene } from "@/components/landing/art";

export const metadata: Metadata = { title: "Apply" };
export const dynamic = "force-dynamic";

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const { resume } = await searchParams;
  const w = windowSummary();
  return (
    <>
      <header className="border-b border-paper-line">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-lg font-bold text-forest-900">AGRA–SMEDAN</Link>
          <Link href="/" className="text-sm font-medium text-ink-soft hover:text-leaf-800">Back to website</Link>
        </div>
      </header>
      <div className="relative h-28 overflow-hidden bg-forest-900 sm:h-36" aria-hidden="true"><FieldScene className="absolute inset-x-0 bottom-0 h-[180px] w-full sm:h-[220px]" /></div>
      <main id="main" className="container-page max-w-3xl py-10 sm:py-14">
        {w.status === "OPEN" ? (
          <>
            <p className="eyebrow">{PROGRAMME.shortName}</p>
            <h1 className="mb-8 mt-2 font-display text-2xl font-semibold text-forest-900 sm:text-3xl">Application form</h1>
            <ApplicationForm resumeToken={resume} />
          </>
        ) : (
          <div className="py-10 text-center">
            <h1 className="font-display text-3xl font-semibold">{w.status === "CLOSED" ? "Applications are closed" : `Applications open on ${w.openLabel}`}</h1>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">{w.range}</p>
            <div className="mt-6"><ApplicationStatus /></div>
            <div className="mt-8"><LinkButton href="/" variant="secondary">Back to the programme</LinkButton></div>
          </div>
        )}
      </main>
    </>
  );
}
