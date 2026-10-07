import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";
import { PROGRAMME } from "@/config/programme";

export const metadata: Metadata = { title: "Privacy notice", description: "How the AGRA–SMEDAN Youth Agri-Innovation Contest handles your personal information.", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="October 2026"
      intro="This notice explains, in plain language, what information the contest collects through this website and how it is used."
      sections={[
        ["What we collect", ["Application form: your name, contact details, date of birth, location, languages, information about disability and rural/urban residence (if you choose to give it), details of your business and its impact, the support you need, and any documents or links you provide.", "Mentor form: your name, contact details, professional background, areas of expertise, availability and any document you upload."]],
        ["Why we collect it", ["To assess applications, select participants, deliver the programme and monitor its results. This matches the declaration you confirm before submitting."]],
        ["Who can see it", ["Only programme staff and authorised reviewers who sign in to the administration area. Public pages never show applicant information. Uploaded files are stored privately and are opened for staff through short-lived secure links."]],
        ["Where it is stored", ["Application records are stored in the programme's Google Sheets workspace. Uploaded documents are stored with our file-storage provider, Cloudinary. If an AI assistant is enabled for staff, it receives only summary figures, not names, contact details or individual records."]],
        ["Keeping and deleting data", [`To ask how long your information is kept, or to ask for it to be corrected or deleted, email ${PROGRAMME.contactEmail} and include your reference number.`]],
        ["Contact", [`${PROGRAMME.contactEmail}`]],
      ]} />
  );
}
