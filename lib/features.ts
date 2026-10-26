import "server-only";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { FEATURES, FEATURE_KEYS, defaultFeatures, type FeatureKey, type FeatureState } from "@/config/features";

/**
 * Reads and changes the feature switches (config/features.ts). One shared copy per server, refreshed every 20 seconds,
 * so a switch takes effect everywhere within about 20 seconds and public pages cost almost no Google Sheets reads.
 * If the sheet cannot be read, the last known switches are kept; with nothing known yet, the defaults are used.
 */
const TTL_MS = 20_000;
const PREFIX = "feature.";
export interface FeatureChange { updatedAt: string; updatedBy: string }
export interface FeatureSnapshot { state: FeatureState; changes: Partial<Record<FeatureKey, FeatureChange>>; source: "sheet" | "defaults" | "last-known"; problem: string | null }
type Cache = { at: number; snap: FeatureSnapshot | null; pending: Promise<FeatureSnapshot> | null };
const cache: Cache = ((globalThis as { __agraFeatures?: Cache }).__agraFeatures ??= { at: 0, snap: null, pending: null });

const parse = (v: string): boolean | null => (/^(on|true|yes|1)$/i.test(v.trim()) ? true : /^(off|false|no|0)$/i.test(v.trim()) ? false : null);

async function read(): Promise<FeatureSnapshot> {
  try {
    const rows = await getRepository().getConfiguration();
    const state = defaultFeatures(); const changes: FeatureSnapshot["changes"] = {};
    for (const r of rows) {   // oldest first: the newest row for each key wins
      const k = r.key.startsWith(PREFIX) ? r.key.slice(PREFIX.length) : "";
      const v = parse(r.value);
      if (!(k in FEATURES) || v === null) continue;
      state[k as FeatureKey] = v; changes[k as FeatureKey] = { updatedAt: r.updatedAt, updatedBy: r.updatedBy };
    }
    return { state, changes, source: "sheet", problem: null };
  } catch (e) {
    const problem = /does not exist/.test((e as Error).message) ? "The Configuration tab is missing. Run npm run setup:sheets once." : `The switches could not be read: ${(e as Error).message.slice(0, 160)}`;
    console.error("[features]", problem);
    return cache.snap ? { ...cache.snap, source: "last-known", problem } : { state: defaultFeatures(), changes: {}, source: "defaults", problem };
  }
}

export async function loadFeatures(fresh = false): Promise<FeatureSnapshot> {
  if (!fresh && cache.snap && Date.now() - cache.at < TTL_MS) return cache.snap;
  cache.pending ??= read().then((snap) => { cache.snap = snap; cache.at = Date.now(); return snap; }).finally(() => { cache.pending = null; });
  return cache.pending;
}
export const features = async () => (await loadFeatures()).state;
export const featureOn = async (k: FeatureKey) => (await loadFeatures()).state[k];

/** Turns a switch on or off (administrators only: checked by the caller). Recorded in the sheet and the activity log. */
export async function setFeature(k: FeatureKey, on: boolean, actor: string): Promise<FeatureSnapshot> {
  const at = new Date().toISOString();
  await getRepository().appendConfiguration({ key: PREFIX + k, value: on ? "on" : "off", updatedAt: at, updatedBy: actor });
  await getRepository().logEvent({ at, applicationId: "-", actor, action: "FEATURE_SWITCHED", detail: `${k} ${on ? "ON" : "OFF"} (${FEATURES[k].label})`.slice(0, 300) }).catch(() => {});
  cache.at = 0;
  return loadFeatures(true);
}

/** What visitors and staff are told when they reach something that is switched off. */
export const OFF_MESSAGE: Record<FeatureKey, string> = {
  level2Form: "The Level 2 application form is closed at the moment. Please check back later or contact the programme team.",
  level2Uploads: "File upload is switched off at the moment. Please paste a link to your file instead (for example a Google Drive link anyone can view).",
  mentorForm: "Panel applications (mentors, judges and reviewers) are closed at the moment.",
  publicAssistant: "The assistant is available to programme staff only. Please sign in.",
  confirmationEmails: "Confirmation emails are switched off.",
  panelScoring: "Scoring is closed at the moment, so nothing can be saved. Your work so far is kept. Contact the programme team if you need to make a change.",
  messages: "Sending messages is switched off in Admin → Settings.",
  aiAssistant: "The AI assistant is switched off in Admin → Settings.",
  aiDataDesk: "The AI data desk is switched off in Admin → Settings.",
};

/** The standard answer from an API route when a feature is off: 503 with a clear message and code FEATURE_OFF. */
export const featureOff = (k: FeatureKey) =>
  NextResponse.json({ message: OFF_MESSAGE[k], code: "FEATURE_OFF", feature: k }, { status: 503, headers: { "Cache-Control": "no-store" } });

export { FEATURE_KEYS };
