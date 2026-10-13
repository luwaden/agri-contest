import { DEFAULT_CRITERIA } from "@/config/scoring";
import type { PanelReview, PanelRole, ReviewStatus } from "@/types/review";

/**
 * STABLE HEADERS for the "Panel Reviews" tab (assignments + score sheets). Only append new columns on the right.
 * One column per rubric criterion so the sheet is readable by people, plus a JSON column for per-criterion notes.
 */
const CRITERIA_IDS = DEFAULT_CRITERIA.map((c) => c.id);
export const REVIEW_HEADERS = [
  "review_id", "application_id", "panel_email", "panel_name", "panel_role", "status", "assigned_at", "assigned_by",
  ...CRITERIA_IDS.map((id) => `score_${id}`), "weighted_total", "overall_comment", "criterion_comments_json", "conflict_note", "updated_at", "submitted_at",
] as const;

const STATUSES: ReviewStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "CONFLICT", "WITHDRAWN"];
const guard = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export const reviewToRow = (r: PanelReview): string[] => [
  r.reviewId, r.applicationId, guard(r.panelEmail), guard(r.panelName), r.panelRole, r.status, r.assignedAt, guard(r.assignedBy),
  ...CRITERIA_IDS.map((id) => (Number.isInteger(r.scores[id]) ? String(r.scores[id]) : "")),
  r.total == null ? "" : String(r.total), guard(r.overallComment), JSON.stringify(r.comments ?? {}), guard(r.conflictNote), r.updatedAt, r.submittedAt ?? "",
];

/** Returns null for rows that are not a usable review (blank or hand-edited beyond repair). */
export function rowToReview(row: string[]): PanelReview | null {
  const at = (i: number) => (row[i] ?? "").toString();
  if (!at(0) || !at(1) || !at(2)) return null;
  const role = at(4).toUpperCase() as PanelRole; const status = at(5).toUpperCase() as ReviewStatus;
  if ((role !== "JUDGE" && role !== "REVIEWER") || !STATUSES.includes(status)) return null;
  const base = 8, n = CRITERIA_IDS.length;
  const scores: Record<string, number> = {};
  CRITERIA_IDS.forEach((id, i) => { const v = Number(at(base + i)); if (at(base + i) !== "" && Number.isInteger(v)) scores[id] = v; });
  let comments: Record<string, string> = {};
  try { const c = JSON.parse(at(base + n + 2) || "{}"); if (c && typeof c === "object") comments = c; } catch { /* keep empty */ }
  const total = at(base + n) === "" ? null : Number(at(base + n));
  return {
    reviewId: at(0), applicationId: at(1), panelEmail: unguard(at(2)).trim().toLowerCase(), panelName: unguard(at(3)), panelRole: role, status,
    assignedAt: at(6), assignedBy: unguard(at(7)), scores, comments, overallComment: unguard(at(base + n + 1)),
    total: Number.isFinite(total) ? total : null, conflictNote: unguard(at(base + n + 3)), updatedAt: at(base + n + 4), submittedAt: at(base + n + 5) || null,
  };
}
