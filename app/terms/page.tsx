import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";
import { PROGRAMME } from "@/config/programme";

export const metadata: Metadata = { title: "Terms", description: "Terms for applying to the AGRA–SMEDAN Youth Agri-Innovation Contest.", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <LegalPage title="Terms of application" updated="October 2026"
      intro="These are the basic terms that apply when you apply to the contest or to become a mentor. The programme team may publish fuller rules for later stages of the contest."
      sections={[
        ["Who may apply", [`Applicants must be Nigerian youth aged ${PROGRAMME.eligibility.minAge} to ${PROGRAMME.eligibility.maxAge} running or building an agribusiness.`, "Each person may submit one application using one email address."]],
        ["Your information", ["You confirm that everything you submit is accurate and complete. Applications containing false information may be disqualified."]],
        ["No guarantee of selection", ["Submitting an application does not guarantee that you will be shortlisted, invited to pitch, or selected as a winner. Decisions are made by the programme team and its reviewers."]],
        ["Use of your information", ["By submitting, you consent to your information being used for programme selection and monitoring, as described in the privacy notice."]],
        ["Questions", [`Contact the programme team at ${PROGRAMME.contactEmail}, quoting your reference number.`]],
      ]} />
  );
}
