export type MentorStatus = "NEW" | "UNDER_REVIEW" | "ACCEPTED" | "DECLINED";

/** Stored separately from applicant records. */
export interface MentorApplication {
  mentorId: string;
  status: MentorStatus;
  submittedAt: string;
  updatedAt: string;
  /** "First Last". Kept for older records and every screen that shows a name. */
  fullName: string;
  /** Asked separately since October 2026. Older records only have fullName. */
  firstName?: string; lastName?: string;
  email: string; phone: string;
  state: string; location: string;
  profession: string; organization: string; industry: string;
  yearsExperience: number;
  mentorshipExperience: string;
  expertise: string[];          // areas they can mentor
  availability: string;         // hours per month band
  availabilityNotes: string;
  linkedin: string; portfolio: string;
  motivation: string;
  documents: Array<{ kind: string; url: string }>;
  consent: boolean;
  source: string;
  /** The role the person applied for: MENTOR, JUDGE or REVIEWER. The form now allows ONE; older records may hold several, and records without it are treated as MENTOR. */
  roles?: string[];
  /** Judges and reviewers confirm they will declare conflicts of interest. */
  coiDeclared?: boolean;
}
