import { DEFAULT_CRITERIA, SCORE_BANDS, TIE_BREAK_ORDER } from "@/config/scoring";
import { PROGRAMME } from "@/config/programme";
import { windowSummary } from "@/lib/window";

/**
 * What the assistant knows. ONE source of facts, written so a person or an AI can answer from it.
 * Rules: only state what the site, the concept note or the Contest Design Framework already says. Never invent
 * dates, amounts or rules; where something is not decided, say so and point to the programme team.
 */
export type Audience = "public" | "panel" | "admin";
export interface Knowledge { id: string; audience: Audience; q: string; keywords: string[]; a: () => string }

const email = PROGRAMME.contactEmail;
const { minAge, maxAge } = PROGRAMME.eligibility;

export const KNOWLEDGE: Knowledge[] = [
  // ───────── everyone ─────────
  { id: "what", audience: "public", q: "What is the contest?", keywords: ["contest", "programme", "program", "about", "agra", "smedan", "what"],
    a: () => `The ${PROGRAMME.name} finds, funds and scales the next generation of Nigerian agripreneurs. It is for young people aged ${minAge} to ${maxAge} building agribusinesses in maize, rice, soybean and allied value chains.` },
  { id: "who", audience: "public", q: "Who can apply?", keywords: ["eligible", "eligibility", "who", "age", "old", "young", "youth", "qualify", "requirements", "nigerian"],
    a: () => `Nigerian youth aged ${minAge} to ${maxAge} who run an agribusiness or are building one, from any state in Nigeria, at any stage from idea to established business. Women, rural youth and persons with disabilities are strongly encouraged to apply.` },
  { id: "dates", audience: "public", q: "When do applications open and close?", keywords: ["deadline", "date", "dates", "close", "closing", "open", "opening", "when", "late", "time"],
    a: () => { const w = windowSummary(); return `${w.range} Applications are currently ${w.status === "OPEN" ? "open" : w.status === "OPENING_SOON" ? "not open yet" : "closed"} (${w.countdown.toLowerCase()}). Times are Nigerian time (WAT).`; } },
  { id: "how", audience: "public", q: "How do I apply?", keywords: ["apply", "application", "how", "start", "form", "submit", "steps"],
    a: () => "Go to the Apply page and complete the three short stages: your profile, your business, and your impact and support needs. You review everything, tick the declaration and submit. You can save your progress and come back." },
  { id: "save", audience: "public", q: "Can I save my application and finish later?", keywords: ["save", "later", "continue", "resume", "draft", "progress", "come back"],
    a: () => "Yes. Use \"Save progress\" on any stage. Your answers are also kept on your device. To continue from another device, use the resume link you are shown after saving." },
  { id: "register", audience: "public", q: "Does my business need to be registered?", keywords: ["register", "registered", "registration", "cac", "business name", "cooperative"],
    a: () => "The form asks for your registration status and, if you are registered with the CAC, your registration number. The programme team will tell you if any later stage needs documents." },
  { id: "upload", audience: "public", q: "Can I upload documents?", keywords: ["upload", "document", "file", "pdf", "pitch", "deck", "attach", "link", "size"],
    a: () => "Supporting material is optional. On the last stage you can upload a file (PDF, image, Word or PowerPoint, up to 8 MB) or paste a link to a file stored online such as Google Drive." },
  { id: "after", audience: "public", q: "What happens after I submit?", keywords: ["after", "submit", "submitted", "reference", "number", "next", "result", "shortlist", "selected", "confirmation"],
    a: () => "You get an application reference number such as AGRA-2026-K7QX4M. Keep it. The programme team reviews all applications, and shortlisted applicants are contacted. Submitting does not guarantee selection. You can ask me about your application by typing your reference number." },
  { id: "change", audience: "public", q: "Can I change my application after submitting?", keywords: ["change", "edit", "correct", "mistake", "update", "withdraw", "wrong"],
    a: () => `Not through the form. Email ${email} with your reference number and what needs to change.` },
  { id: "one", audience: "public", q: "Can I apply more than once?", keywords: ["twice", "again", "duplicate", "more than once", "same email", "already"],
    a: () => "Each person can submit one application, using one email address. If you see a message that an application already exists, email the programme team." },
  { id: "state", audience: "public", q: "Do I need to live in a particular state?", keywords: ["state", "location", "kaduna", "lagos", "abuja", "region", "where", "live"],
    a: () => "No. The contest is open to applicants from every state in Nigeria." },
  { id: "prize", audience: "public", q: "What do winners receive?", keywords: ["prize", "winner", "win", "money", "grant", "seed", "capital", "benefit", "reward", "amount", "naira"],
    a: () => "Ten winners receive seed capital and support, followed by six months of mentorship and aftercare, plus introductions to financiers. The prize amounts have not been announced." },
  { id: "free", audience: "public", q: "Is there a fee to apply?", keywords: ["fee", "pay", "payment", "cost", "free", "charge", "money", "scam"],
    a: () => `No payment is required to apply or to progress. If anyone asks you for money in connection with the contest, report it to ${email}.` },
  { id: "panel", audience: "public", q: "How can I become a mentor, judge or reviewer?", keywords: ["mentor", "judge", "reviewer", "review", "volunteer", "panel", "expert", "join"],
    a: () => "Open the \"Join the panel\" page (Call for Experts, judges and reviewers) and answer a few short questions. The programme team reviews every application and tells you your role." },
  { id: "privacy", audience: "public", q: "How is my information used?", keywords: ["privacy", "data", "personal", "information", "protect", "consent", "safe", "ndpa"],
    a: () => "Your information is used to assess applications, select participants and monitor the programme. Only authorised programme staff can see it. See the Privacy notice page for details." },
  { id: "contact", audience: "public", q: "How do I contact the programme team?", keywords: ["contact", "email", "help", "support", "reach", "phone", "question", "problem", "issue"],
    a: () => `Email ${email} and include your reference number if you have one.` },
  { id: "error", audience: "public", q: "The form shows an error or will not submit", keywords: ["error", "not working", "fails", "failed", "broken", "bug", "stuck", "cannot", "can't"],
    a: () => `Read the red message under the field: it says what to fix. If you see "Something went wrong on our side", wait a minute and try again, and keep the reference code shown. If it keeps happening, email ${email} with that code. Your answers are saved on your device.` },

  // ───────── judges & reviewers (and staff) ─────────
  { id: "rubric", audience: "panel", q: "What is the scoring rubric?", keywords: ["rubric", "criteria", "criterion", "score", "scoring", "weight", "weights", "weighting", "marks"],
    a: () => `Each criterion is scored 1 to 10 and weighted to give a total out of 100: ${DEFAULT_CRITERIA.map((c) => `${c.name} ${c.weight}%`).join(", ")}.` },
  { id: "bands", audience: "panel", q: "What do the score bands mean?", keywords: ["band", "bands", "exceptional", "strong", "adequate", "weak", "insufficient", "mean", "descriptor"],
    a: () => SCORE_BANDS.map((b) => `${b.min}-${b.max} ${b.band}: ${b.text}`).join(" ") },
  { id: "coi", audience: "panel", q: "What is a conflict of interest and what should I do?", keywords: ["conflict", "interest", "coi", "declare", "relationship", "friend", "family", "reassign"],
    a: () => "Do not score an entry from anyone with whom you have a personal, commercial, advisory or investment relationship. Tell the programme team and the entry will be reassigned. Every judge and reviewer signs a declaration before scoring." },
  { id: "tie", audience: "panel", q: "How are ties broken?", keywords: ["tie", "ties", "tiebreak", "tie-break", "equal", "same score"],
    a: () => `Ties are broken by the higher raw score on ${TIE_BREAK_ORDER.join(", then ")}. If still tied, the moderation panel decides and records the basis.` },
  { id: "role", audience: "panel", q: "What is the difference between a judge and a reviewer?", keywords: ["difference", "judge", "reviewer", "role", "responsibility", "what do i do"],
    a: () => "Reviewers score entries against the rubric in the screening rounds. Judges score entries in the later rounds and take part in the finale. Programme staff do not score entries. Both only see applications assigned to them." },
  { id: "assigned", audience: "panel", q: "Where are my assigned applications?", keywords: ["assigned", "assignment", "my applications", "nothing", "empty", "none", "see", "list"],
    a: () => "Your portal lists applications assigned to you. If it says none yet, scoring has not opened or the programme team has not assigned entries to you; they will tell you when it does." },
  { id: "login", audience: "panel", q: "I cannot sign in", keywords: ["sign in", "login", "log in", "password", "account", "access", "forgot", "locked"],
    a: () => `Accounts are created by the programme team. After 5 wrong attempts you are locked out for 15 minutes. If your password is lost or you have no account, email ${email} (ask for a password reset); do not share passwords.` },

  // ───────── administrators and coordinators ─────────
  { id: "export", audience: "admin", q: "How do I export applications?", keywords: ["export", "csv", "download", "spreadsheet", "excel", "report"],
    a: () => "On the Dashboard or Applications page, set any filters you want, then choose Export CSV. The export respects your filters and is logged." },
  { id: "filters", audience: "admin", q: "How do I filter by state or zone?", keywords: ["filter", "state", "zone", "region", "lga", "gender", "kaduna", "niger", "nasarawa", "segment"],
    a: () => "Open Filters on the Dashboard or Applications page. You can filter by state, geopolitical zone, LGA, location group, gender, disability, rural or urban, value chain, stage, status, language and date. Every figure on the dashboard updates." },
  { id: "status", audience: "admin", q: "How do I change an application's status?", keywords: ["status", "shortlist", "shortlisted", "review", "reject", "change status", "move"],
    a: () => "On the Applications table choose a status in the Actions column, or open the application and use the status menu. Changes are written to the audit log." },
  { id: "access", audience: "admin", q: "How do staff accounts and roles work?", keywords: ["account", "role", "roles", "user", "users", "permission", "permissions", "add user", "new reviewer", "password"],
    a: () => "Staff sign in with an email and password. Roles: Administrator (everything), Coordinator (applications, analytics, export, panel applications), Judge and Reviewer (only applications assigned to them). To add someone run: npm run make-user -- \"email\" \"Name\" ROLE \"password\", paste the result into ADMIN_USERS_JSON on Vercel, and redeploy." },
  { id: "health", audience: "admin", q: "How do I check the system is healthy?", keywords: ["health", "check", "status page", "broken", "500", "error", "down", "sheet", "redis", "diagnose"],
    a: () => "Open /api/health?check=store on the live site. It reports whether the data store, tabs, Redis and AI are reachable and, if not, what to fix." },
  { id: "analytics", audience: "admin", q: "What can I ask about the applicants?", keywords: ["ask", "analytics", "how many", "percentage", "which states", "summary", "summarise", "statistics"],
    a: () => "Ask for counts and shares, for example: How many applied from Kaduna? Which states have the most applicants? What share are women? I answer from summary figures only; names and contact details are never shared with the AI." },
];

export const audiencesFor = (role?: string): Audience[] => (role === "ADMIN" || role === "COORDINATOR" ? ["public", "panel", "admin"] : role === "JUDGE" || role === "REVIEWER" ? ["public", "panel"] : ["public"]);

export const SUGGESTIONS: Record<"public" | "panel" | "admin", string[]> = {
  public: ["Who can apply?", "When do applications close?", "Can I save and finish later?", "How do I check my application?"],
  panel: ["What is the scoring rubric?", "What is a conflict of interest?", "How are ties broken?", "Where are my assigned applications?"],
  admin: ["How many applicants are there?", "Which states have the most applicants?", "How do I export applications?", "How do I add a reviewer?"],
};
