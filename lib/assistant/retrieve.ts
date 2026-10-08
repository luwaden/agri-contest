import { KNOWLEDGE, audiencesFor, type Knowledge } from "@/config/knowledge";

const STOP = new Set("a an the is are am do does did can could i me my we you your to of in on for and or it this that with how what when where who why be have has will would should any there about please".split(" "));
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

/** Entries this person is allowed to see, best match first. Score = keyword hits (x3) + words shared with the entry's question. */
export function rank(question: string, role?: string): Array<{ entry: Knowledge; score: number }> {
  const allowed = new Set(audiencesFor(role));
  const q = question.toLowerCase(); const qt = new Set(tokens(question));
  return KNOWLEDGE.filter((k) => allowed.has(k.audience)).map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) if (q.includes(kw)) score += kw.includes(" ") ? 4 : 3;
    for (const t of tokens(entry.q)) if (qt.has(t)) score += 1;
    return { entry, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

/** No-AI answer: the best matching entry, or null when nothing matches well enough. */
export function basicAnswer(question: string, role?: string): { answer: string; related: string[] } | null {
  const r = rank(question, role);
  if (!r.length || r[0].score < 3) return null;
  return { answer: r[0].entry.a(), related: r.slice(1, 3).filter((x) => x.score >= 3).map((x) => x.entry.q) };
}

/** Everything the person may know, as text, for the AI prompt. */
export const knowledgeText = (role?: string) => {
  const allowed = new Set(audiencesFor(role));
  return KNOWLEDGE.filter((k) => allowed.has(k.audience)).map((k) => `Q: ${k.q}\nA: ${k.a()}`).join("\n\n");
};
