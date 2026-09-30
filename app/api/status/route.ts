import { NextResponse } from "next/server";
import { windowSummary } from "@/lib/window";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(windowSummary()); }
