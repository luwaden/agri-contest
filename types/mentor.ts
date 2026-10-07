export type MentorStatus = "NEW" | "UNDER_REVIEW" | "ACCEPTED" | "DECLINED";

/** Stored separately from applicant records. */
export interface MentorApplication {
  mentorId: string;
  status: MentorStatus;
  submittedAt: string;
  updatedAt: string;
  fullName: string; email: string; phone: string;
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
}
