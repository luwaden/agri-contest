"use client";
import { Fragment } from "react";
import { AGRI_IMPACT_AREAS, APPLICANT_ROLES, BUSINESS_STAGES, DISABILITY_OPTIONS, DISABILITY_TYPES, GENDERS, REGISTRATION_STATUSES, REVENUE_RANGES, SETTINGS, SUPPORT_NEEDS, VALUE_CHAINS } from "@/config/programme";
import { calculateAge } from "@/lib/dates";
import { CheckboxField, type Values } from "./fields";

type Opts = ReadonlyArray<{ value: string; label: string }>;
const lab = (o: Opts, v: string) => o.find((x) => x.value === v)?.label ?? v;
const labs = (o: Opts, v: string[] = []) => v.map((x) => lab(o, x)).join(", ");

interface Section { title: string; stage: 0 | 1 | 2; rows: Array<[string, string]> }

export function buildReviewSections(v: Values): Section[] {
  return [
    { title: "Applicant profile", stage: 0, rows: [
      ["Name", [v.firstName, v.middleName, v.lastName].filter(Boolean).join(" ")], ["Gender", lab(GENDERS, v.gender)],
      ["Date of birth", `${v.dateOfBirth ?? ""}${v.dateOfBirth && calculateAge(v.dateOfBirth) !== null ? ` (${calculateAge(v.dateOfBirth)} years)` : ""}`],
      ["Phone", v.phone], ["WhatsApp", v.whatsapp || "Same as phone"], ["Email", v.email], ["Nationality", v.nationality],
      ["Location", `${v.community}, ${v.lga}, ${v.state}`], ["Address", v.address], ["Area", lab(SETTINGS, v.residenceSetting)],
      ["Languages", [...(v.languages ?? []), v.languagesOther].filter(Boolean).join(", ")],
      ["Person with a disability", lab(DISABILITY_OPTIONS, v.disability) + (v.disability === "YES" ? ` · ${lab(DISABILITY_TYPES, v.disabilityType)}` : "")],
      ...(v.disability === "YES" && v.accessibilityNeeds ? [["Accessibility support", v.accessibilityNeeds] as [string, string]] : []),
    ]},
    { title: "Business", stage: 1, rows: [
      ["Business name", v.businessName], ["Value chain", lab(VALUE_CHAINS, v.valueChain) + (v.valueChainOther ? ` · ${v.valueChainOther}` : "")],
      ["Stage", lab(BUSINESS_STAGES, v.businessStage)], ["Your role", lab(APPLICANT_ROLES, v.applicantRole) + (v.applicantRoleOther ? ` · ${v.applicantRoleOther}` : "")],
      ["Registration", lab(REGISTRATION_STATUSES, v.registrationStatus) + (v.registrationNumber ? ` · ${v.registrationNumber}` : "")],
      ["Year started", v.yearStarted || "Not started trading"],
      ["Location", `${v.businessAddress}, ${v.businessLga}, ${v.businessState} (${lab(SETTINGS, v.businessSetting)})`],
      ["Website", v.website || "None"], ["Social media", v.socialHandles || "None"],
    ]},
    { title: "Innovation", stage: 1, rows: [
      ["Description", v.description], ["Problem", v.problem], ["Solution", v.solution], ["What is different", v.originality], ["What is innovative", v.innovation],
    ]},
    { title: "Customers, revenue and team", stage: 1, rows: [
      ["Main customers", v.mainCustomers], ["Target market", v.targetMarket], ["Customers served", v.customersServed],
      ["Earning revenue", v.generatesRevenue === "YES" ? `Yes · ${lab(REVENUE_RANGES, v.revenueRange)}` : "Not yet"],
      ["Employees", `${v.fullTime} full-time, ${v.partTime} part-time · ${v.youthEmployed} young people · ${v.womenEmployed} women`],
      ["Reach", `${v.farmersReached} farmers · ${v.jobsCreated} jobs · ${v.womenReached} women · ${v.youthReached} youth · ${v.communitiesReached} rural communities`],
    ]},
    { title: "Impact and support", stage: 2, rows: [
      ["Measurable change", v.socialImpact], ["Who benefits most", v.beneficiaries], ["People or communities benefited", v.peopleBenefited],
      ["Agricultural impact", labs(AGRI_IMPACT_AREAS, v.agriImpactAreas) || "None selected"],
      ...(v.environmentalImpact ? [["Agricultural impact detail", v.environmentalImpact] as [string, string]] : []),
      ["Support needed", labs(SUPPORT_NEEDS, v.supportNeeds) + (v.supportNeedsOther ? ` · ${v.supportNeedsOther}` : "")],
      ["Goal for the programme", v.programmeGoal],
      ["Supporting links", [v.docPitchDeck, v.docBusiness, v.docRegistration, v.docImages, v.docEvidence].filter(Boolean).join("\n") || "None"],
    ]},
  ];
}

export function Review({ values, onEdit, declarationError }: { values: Values; onEdit: (stage: 0 | 1 | 2) => void; declarationError?: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Review Your Application</h2>
        <p className="mt-1 text-ink-soft">Please check your answers. Nothing is sent until you tick the declaration and press Submit Application.</p>
      </div>
      {buildReviewSections(values).map((s) => (
        <section key={s.title} className="rounded-lg border border-paper-line">
          <div className="flex items-center justify-between border-b border-paper-line px-4 py-3 sm:px-5">
            <h3 className="font-semibold text-forest-900">{s.title}</h3>
            <button type="button" onClick={() => onEdit(s.stage)} className="rounded px-2 py-1 text-sm font-semibold text-leaf-800 underline-offset-2 hover:underline">Edit<span className="sr-only"> {s.title}</span></button>
          </div>
          <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[180px_1fr] sm:px-5">
            {s.rows.map(([k, val]) => (
              <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px] text-forest-900">{val || "—"}</dd></Fragment>
            ))}
          </dl>
        </section>
      ))}
      <section className="space-y-3">
        <h3 className="font-display text-xl font-semibold">Declaration</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>The information I have provided is accurate and complete.</li>
          <li>I agree to the programme terms.</li>
          <li>I consent to my data being used for programme selection and monitoring.</li>
          <li>I understand that submitting an application does not guarantee selection.</li>
        </ul>
        <CheckboxField name="declaration">I confirm the declaration above.</CheckboxField>
        {declarationError && <p className="sr-only">{declarationError}</p>}
      </section>
    </div>
  );
}
