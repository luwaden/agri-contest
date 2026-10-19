/** A message the programme team sends to a chosen group of applicants (Admin → Messages). Stored append-only. */
export interface EmailCampaign {
  campaignId: string;
  createdAt: string;
  createdBy: string;
  subject: string;
  /** The text with fill-ins such as {first_name}; filled per applicant when sent. */
  body: string;
  /** Plain description of who it is for, e.g. "Passed by reviewers (150)". */
  audience: string;
  recipientIds: string[];
}
/** One line per attempt. A campaign is cancelled by a CANCELLED line (nothing is ever edited). */
export interface EmailLogRow { at: string; campaignId: string; applicationId: string; email: string; status: "SENT" | "FAILED" | "CANCELLED" | "TEST"; detail: string }
