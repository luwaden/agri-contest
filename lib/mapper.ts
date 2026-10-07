import type { Application, ApplicationStatus } from "@/types/application";
import { calculateAge } from "@/lib/dates";
import { locationGroupFor } from "@/lib/location";
import { normalisePhone, type ParsedForm } from "@/lib/validation/application";
import { DOCUMENT_KINDS } from "@/config/programme";

const n = (v: unknown) => Number(v) || 0;
const DOC_FIELDS: Array<[string, (typeof DOCUMENT_KINDS)[number]["value"]]> = [
  ["docPitchDeck", "PITCH_DECK"], ["docBusiness", "BUSINESS_DOC"], ["docRegistration", "REGISTRATION"],
  ["docImages", "PRODUCT_IMAGES"], ["docEvidence", "EVIDENCE"],
];

/** Turns already-validated flat form data into the canonical record. Derived fields are computed here, server-side. */
export function toApplication(
  f: ParsedForm,
  meta: { applicationId: string; status: ApplicationStatus; now: Date; source?: string },
): Application {
  const iso = meta.now.toISOString();
  const group = locationGroupFor(f.state);
  const submitted = meta.status !== "DRAFT";
  return {
    applicationId: meta.applicationId,
    submissionStatus: meta.status,
    submittedAt: submitted ? iso : null,
    applicant: {
      firstName: f.firstName, middleName: f.middleName, lastName: f.lastName, gender: f.gender,
      dateOfBirth: f.dateOfBirth, age: calculateAge(f.dateOfBirth, meta.now) ?? 0,
      phone: normalisePhone(f.phone), whatsapp: f.whatsapp ? normalisePhone(f.whatsapp) : "",
      email: f.email, nationality: f.nationality, address: f.address, community: f.community,
    },
    location: { state: f.state, lga: f.lga, locationGroup: group },
    inclusion: {
      disability: f.disability,
      disabilityType: f.disability === "YES" ? f.disabilityType : "",
      accessibilityNeeds: f.disability === "YES" ? f.accessibilityNeeds : "",
      residenceSetting: f.residenceSetting,
      rural: f.residenceSetting === "RURAL" || f.businessSetting === "RURAL",
    },
    languages: f.languages.map((l: string) => (l === "Other" && f.languagesOther ? `Other: ${f.languagesOther}` : l)),
    business: {
      businessName: f.businessName, registrationStatus: f.registrationStatus,
      registrationNumber: f.registrationStatus === "CAC_REGISTERED" ? f.registrationNumber : "",
      yearStarted: f.yearStarted ? Number(f.yearStarted) : null,
      state: f.businessState, lga: f.businessLga, address: f.businessAddress, setting: f.businessSetting,
      website: f.website, socialHandles: f.socialHandles,
      valueChain: f.valueChain, valueChainOther: f.valueChain === "OTHER" ? f.valueChainOther : "",
      stage: f.businessStage, applicantRole: f.applicantRole, applicantRoleOther: f.applicantRole === "OTHER" ? f.applicantRoleOther : "",
      description: f.description, problem: f.problem, solution: f.solution, originality: f.originality, innovation: f.innovation,
      mainCustomers: f.mainCustomers, targetMarket: f.targetMarket, customersServed: n(f.customersServed),
      generatesRevenue: f.generatesRevenue === "YES",
      revenueRange: f.generatesRevenue === "YES" ? f.revenueRange : "NONE", revenueSource: f.revenueSource,
      employees: { fullTime: n(f.fullTime), partTime: n(f.partTime), youth: n(f.youthEmployed), women: n(f.womenEmployed) },
    },
    impact: {
      farmersReached: n(f.farmersReached), jobsCreated: n(f.jobsCreated), womenReached: n(f.womenReached),
      youthReached: n(f.youthReached), communitiesReached: n(f.communitiesReached), peopleBenefited: n(f.peopleBenefited),
      socialImpact: f.socialImpact, beneficiaries: f.beneficiaries,
      agriImpactAreas: f.agriImpactAreas ?? [], environmentalImpact: f.environmentalImpact,
    },
    supportNeeds: f.supportNeeds, supportNeedsOther: f.supportNeeds.includes("OTHER") ? f.supportNeedsOther : "",
    programmeGoal: f.programmeGoal,
    documents: DOC_FIELDS.filter(([k]) => f[k]).map(([k, kind]) => ({ kind, url: f[k] })),
    declaration: { accepted: submitted, acceptedAt: submitted ? iso : null },
    metadata: { createdAt: iso, updatedAt: iso, source: meta.source ?? "web", locationGroup: group },
    score: null,
  };
}
