import { L2_AGE, L2_CROPS, L2_DISABILITY, L2_EDUCATION, L2_GENDER, L2_NEEDS, L2_REGISTRATION, L2_SETTING, YES_NO } from "@/config/level2";
import type { Level2Application } from "@/types/level2";

/** Level 2 answers as people read them (labels, not stored codes). Shared by the admin detail page and the reviewer page. */
type Opt = ReadonlyArray<{ value: string; label: string }>;
const label = (list: Opt, v: string) => list.find((o) => o.value === v)?.label ?? v;
const yn = (v: string) => label(YES_NO, v);
const crop = (s: Level2Application) => (s.cropType === "OTHER" ? `Other: ${s.cropTypeOther}` : label(L2_CROPS, s.cropType));
const needLabel = (q: string) => q.replace(/^Does the SME need support with /, "").replace(/\?$/, "").replace(/^./, (c) => c.toUpperCase());

/** The few facts a reviewer needs first. */
export function l2Facts(s: Level2Application): Array<[string, string]> {
  const needs = L2_NEEDS.filter(([k]) => s[k] === "YES").map(([, q]) => needLabel(q).replace(/^Access to /, ""));
  if (s.hasOtherNeeds === "YES" && s.otherNeeds) needs.push(s.otherNeeds);
  return [
    ["Crop", crop(s)],
    ["Running since", s.yearEstablished],
    ["Staff", `${s.permanentEmployees} permanent · ${s.casualEmployees} casual`],
    ["Farmers served a year", s.farmersServed],
    ["Location", `${s.lga}, ${s.state} · ${label(L2_SETTING, s.setting)}`],
    ["Owner", `${label(L2_GENDER, s.ownerGender)} · ${label(L2_AGE, s.ownerAge)}${s.disability === "YES" ? " · disability" : ""}`],
    ["CAC certificate", yn(s.hasCac)],
    ["Support wanted", needs.join(", ") || "None"],
  ];
}

export function l2AnswerSections(s: Level2Application): Array<{ title: string; rows: Array<[string, string]> }> {
  return [
    { title: "The business and its owner", rows: [
      ["Business name", s.businessName], ["Year of establishment", s.yearEstablished], ["Contact person (Founder/CEO)", s.contactName],
      ["Telephone", s.phone], ["Email (on this form)", s.email], ["Email (Level 1)", s.level1Email],
      ["State", s.state], ["LGA", s.lga], ["Community / village / ward", s.community], ["Rural or urban", label(L2_SETTING, s.setting)],
      ["Gender of owner", label(L2_GENDER, s.ownerGender)], ["Age of owner", label(L2_AGE, s.ownerAge)],
      ["Disability", label(L2_DISABILITY, s.disability)], ["Highest education", label(L2_EDUCATION, s.ownerEducation)],
    ] },
    { title: "Operations", rows: [
      ["Crop type", crop(s)], ["Has a CAC certificate", yn(s.hasCac)],
      ["Type of registration", s.registrationType === "OTHER" ? `Other: ${s.registrationTypeOther}` : label(L2_REGISTRATION, s.registrationType)],
      ["Permanent employees", s.permanentEmployees], ["Casual employees", s.casualEmployees], ["Farmers served a year (approx.)", s.farmersServed],
      ["Trained on input distribution", yn(s.trainedInputDistribution)],
      ["Belongs to an association", s.inAssociation === "YES" && s.associationName ? `Yes: ${s.associationName}` : yn(s.inAssociation)],
      ["Support from AGRA-funded projects", yn(s.agraSupport)], ["Business bank account", yn(s.hasBusinessBankAccount)],
    ] },
    { title: "Support the SME needs", rows: [
      ...L2_NEEDS.map(([k, q]): [string, string] => [needLabel(q), yn(s[k])]),
      ["Other needs", s.hasOtherNeeds === "YES" ? s.otherNeeds || "Yes" : yn(s.hasOtherNeeds)],
    ] },
  ];
}

/** Contact details are for the programme team, not reviewers. */
const CONTACT = new Set(["Telephone", "Email (on this form)", "Email (Level 1)"]);
export const l2AnswerSectionsForReviewer = (s: Level2Application) =>
  l2AnswerSections(s).map((sec) => ({ ...sec, rows: sec.rows.filter(([k]) => !CONTACT.has(k)) }));
