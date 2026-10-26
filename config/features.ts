/**
 * FEATURE SWITCHES (Admin → Settings). Each switch is checked on the server, not only hidden in the page.
 * Stored in the "Configuration" tab of the sheet as rows `feature.<key> | on/off | when | who`; the newest row wins,
 * so the tab is also the history of every change. A switch with no row uses `default`.
 *
 * Add a switch: add it here, then check it with `featureOn("<key>")` where the feature runs.
 */
export const FEATURES = {
  level2Form: {
    group: "Public forms", label: "Level 2 application form",
    on: "Invited applicants can start and submit the Level 2 form at /level-2.",
    off: "The /level-2 page says the form is closed. Nobody can start, upload to or submit it.",
    default: true,
  },
  level2Uploads: {
    group: "Public forms", label: "File uploads on the Level 2 form",
    on: "Applicants can upload their documents.",
    off: "Applicants paste links (for example Google Drive) instead. Use this if uploads are failing.",
    default: true,
  },
  mentorForm: {
    group: "Public forms", label: "Panel application form (mentors, judges, reviewers)",
    on: "Experts can apply at /mentors.",
    off: "The /mentors page stays up, but the form is replaced by a 'closed' notice and new applications are refused.",
    default: true,
  },
  publicAssistant: {
    group: "Public forms", label: "Help assistant for visitors",
    on: "Visitors who are not signed in see the help assistant button.",
    off: "Only signed-in staff see the assistant.",
    default: process.env.NEXT_PUBLIC_ASSISTANT_PUBLIC === "true",
  },
  confirmationEmails: {
    group: "Public forms", label: "Automatic confirmation emails",
    on: "Applicants get a confirmation email after submitting (Level 1 and Level 2).",
    off: "No automatic confirmation emails are sent. Submissions still work.",
    default: true,
  },
  panelScoring: {
    group: "Judging and screening", label: "Judges and reviewers can score",
    on: "Judges and reviewers can save and submit score sheets and use 'Pass to next stage'.",
    off: "Score sheets are locked: nothing can be saved, submitted, passed or declared. Use this when a round is closed.",
    default: true,
  },
  messages: {
    group: "Staff tools", label: "Sending messages",
    on: "Administrators can send messages from Admin → Messages.",
    off: "No email leaves Admin → Messages (a message being sent stops at its next batch). Writing and previewing still work.",
    default: true,
  },
  aiAssistant: {
    group: "Staff tools", label: "AI assistant (staff)",
    on: "Staff can ask questions in Admin → AI assistant.",
    off: "The AI assistant page answers nothing. No AI requests are made from it.",
    default: true,
  },
  aiDataDesk: {
    group: "Staff tools", label: "AI data desk",
    on: "Administrators can use Admin → AI data desk.",
    off: "The AI data desk answers nothing. No AI requests are made and no AI tabs are written.",
    default: true,
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
export const isFeatureKey = (k: unknown): k is FeatureKey => typeof k === "string" && k in FEATURES;
export type FeatureState = Record<FeatureKey, boolean>;
export const defaultFeatures = (): FeatureState => Object.fromEntries(FEATURE_KEYS.map((k) => [k, FEATURES[k].default])) as FeatureState;
