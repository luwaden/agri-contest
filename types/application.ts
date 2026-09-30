import type { LocationGroup } from "@/config/programme";

export type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "NOT_SELECTED" | "FINALIST" | "WINNER";

export interface ApplicationDocument { kind: string; url: string }

/** The canonical stored record. Storage backends map this to their own layout. */
export interface Application {
  applicationId: string;
  submissionStatus: ApplicationStatus;
  submittedAt: string | null;

  applicant: {
    firstName: string; middleName: string; lastName: string;
    gender: "FEMALE" | "MALE";
    dateOfBirth: string; age: number;
    phone: string; whatsapp: string; email: string; nationality: string;
    address: string; community: string;
  };
  location: { state: string; lga: string; locationGroup: LocationGroup };
  inclusion: {
    disability: "YES" | "NO" | "PREFER_NOT_TO_SAY";
    disabilityType: string; accessibilityNeeds: string;
    residenceSetting: "RURAL" | "URBAN";
    /** Derived: true if residence OR business location is rural. */
    rural: boolean;
  };
  languages: string[];
  business: {
    businessName: string; registrationStatus: string; registrationNumber: string;
    yearStarted: number | null; state: string; lga: string; address: string;
    setting: "RURAL" | "URBAN"; website: string; socialHandles: string;
    valueChain: string; valueChainOther: string; stage: string;
    applicantRole: string; applicantRoleOther: string;
    description: string; problem: string; solution: string; originality: string; innovation: string;
    mainCustomers: string; targetMarket: string; customersServed: number;
    generatesRevenue: boolean; revenueRange: string; revenueSource: string;
    employees: { fullTime: number; partTime: number; youth: number; women: number };
  };
  impact: {
    farmersReached: number; jobsCreated: number; womenReached: number; youthReached: number;
    communitiesReached: number; peopleBenefited: number;
    socialImpact: string; beneficiaries: string;
    agriImpactAreas: string[]; environmentalImpact: string;
  };
  supportNeeds: string[]; supportNeedsOther: string; programmeGoal: string;
  documents: ApplicationDocument[];
  declaration: { accepted: boolean; acceptedAt: string | null };
  metadata: { createdAt: string; updatedAt: string; source: string; locationGroup: LocationGroup };
  /** Populated by the judging system (Batch 3+). */
  score: number | null;
}
