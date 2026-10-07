"use client";
import {
  AGRI_IMPACT_AREAS, APPLICANT_ROLES, BUSINESS_STAGES, DISABILITY_OPTIONS, DISABILITY_TYPES, DOCUMENT_KINDS, GENDERS, LANGUAGES,
  LGA_SUGGESTIONS, NIGERIAN_STATES, REGISTRATION_STATUSES, REVENUE_RANGES, SETTINGS, SUPPORT_NEEDS, VALUE_CHAINS,
} from "@/config/programme";
import { LIMITS } from "@/lib/validation/application";
import { calculateAge } from "@/lib/dates";
import { CheckboxGroupField, FormCtx, FormSection, NumberField, RadioField, Row, SelectField, TextAreaField, TextField, type Values } from "./fields";
import { useContext } from "react";
import { UploadField } from "./UploadField";

const useValues = () => useContext(FormCtx).values;

export function StageProfile() {
  const v = useValues();
  const age = v.dateOfBirth ? calculateAge(v.dateOfBirth) : null;
  const lgas = LGA_SUGGESTIONS[v.state] ?? [];
  return (
    <div className="space-y-10">
      <FormSection title="Personal information" description="Use your legal name as it appears on your ID.">
        <Row><TextField name="firstName" label="First name" required autoComplete="given-name" /><TextField name="middleName" label="Middle name" autoComplete="additional-name" /></Row>
        <Row><TextField name="lastName" label="Last name" required autoComplete="family-name" />
          <SelectField name="gender" label="Gender" required options={GENDERS} /></Row>
        <Row>
          <TextField name="dateOfBirth" label="Date of birth" required type="date" autoComplete="bday" />
          <div className="space-y-1.5">
            <p className="text-[15px] font-medium text-forest-900">Age</p>
            <p className="input-base bg-neutral-50 text-ink-soft" aria-live="polite">{age !== null ? `${age} years` : "Calculated from your date of birth"}</p>
          </div>
        </Row>
        <Row><TextField name="phone" label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" />
          <TextField name="whatsapp" label="WhatsApp number" type="tel" inputMode="tel" hint="Leave blank if it is the same as your phone number." /></Row>
        <Row><TextField name="email" label="Email address" required type="email" inputMode="email" autoComplete="email" hint="We will use this to contact you about your application." />
          <TextField name="nationality" label="Nationality" required autoComplete="country-name" /></Row>
      </FormSection>

      <FormSection title="Where you live" description="This helps us make sure the contest reaches every part of Nigeria.">
        <Row>
          <SelectField name="state" label="State of residence" required options={NIGERIAN_STATES} placeholder="Select your state" />
          <div>
            <TextField name="lga" label="Local Government Area" required list="lga-options" />
            <datalist id="lga-options">{lgas.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
        </Row>
        <Row><TextField name="community" label="Community or town" required /><TextField name="address" label="Home address" required autoComplete="street-address" /></Row>
        <RadioField name="residenceSetting" label="Do you live in a rural or an urban area?" required options={SETTINGS}
          hint="Rural means a village or farming community outside a town centre." columns />
      </FormSection>

      <FormSection title="Languages">
        <CheckboxGroupField name="languages" label="What Nigerian languages can you speak?" required hint="Select all that apply." options={LANGUAGES} />
        {Array.isArray(v.languages) && v.languages.includes("Other") && <TextField name="languagesOther" label="Other — please specify" required />}
      </FormSection>

      <FormSection title="Inclusion" description="This programme is committed to including persons with disabilities. Your answer is optional and will not affect how we treat your application.">
        <RadioField name="disability" label="Do you identify as a person with a disability?" required options={DISABILITY_OPTIONS} columns />
        {v.disability === "YES" && (
          <div className="animate-rise space-y-5 rounded-md border border-paper-line bg-paper-warm p-4 sm:p-5">
            <SelectField name="disabilityType" label="Type of disability" required options={DISABILITY_TYPES} />
            <TextAreaField name="accessibilityNeeds" label="Accessibility support you may need" max={LIMITS.mid} rows={3}
              hint="For example, sign interpretation, screen-reader-friendly documents or step-free venues." />
          </div>
        )}
      </FormSection>
    </div>
  );
}

export function StageBusiness() {
  const v = useValues();
  return (
    <div className="space-y-10">
      <FormSection title="Your business" description="Tell us about the agribusiness or venture you run or are building.">
        <TextField name="businessName" label="Business or venture name" required />
        <Row>
          <SelectField name="valueChain" label="Main value chain" required options={VALUE_CHAINS} hint="Maize, rice and soybean are the programme's priority value chains." />
          <SelectField name="businessStage" label="Business stage" required options={BUSINESS_STAGES.map((s) => ({ value: s.value, label: `${s.label} — ${s.hint}` }))} />
        </Row>
        {v.valueChain === "OTHER" && <TextField name="valueChainOther" label="Which value chain?" required />}
        <Row>
          <SelectField name="applicantRole" label="Your role" required options={APPLICANT_ROLES} />
          {v.applicantRole === "OTHER" && <TextField name="applicantRoleOther" label="Describe your role" required />}
        </Row>
        <Row>
          <SelectField name="registrationStatus" label="Business registration status" required options={REGISTRATION_STATUSES} />
          {v.registrationStatus === "CAC_REGISTERED" && <TextField name="registrationNumber" label="CAC registration number" required placeholder="RC 1234567" />}
        </Row>
        <TextField name="yearStarted" label="Year the business started" required={v.businessStage !== "IDEA"} inputMode="numeric" placeholder="2022" />
      </FormSection>

      <FormSection title="Business location">
        <Row>
          <SelectField name="businessState" label="State" required options={NIGERIAN_STATES} placeholder="Select state" />
          <div><TextField name="businessLga" label="Local Government Area" required list="blga-options" />
            <datalist id="blga-options">{(LGA_SUGGESTIONS[v.businessState] ?? []).map((l) => <option key={l} value={l} />)}</datalist></div>
        </Row>
        <TextField name="businessAddress" label="Business address" required />
        <RadioField name="businessSetting" label="Does the business operate in a rural or an urban area?" required options={SETTINGS} columns />
        <Row><TextField name="website" label="Website" type="url" inputMode="url" placeholder="https://" /><TextField name="socialHandles" label="Social media handles" placeholder="@yourbusiness" /></Row>
      </FormSection>

      <FormSection title="Your innovation" description="Judges will read this section most closely. Be specific and use plain language.">
        <TextAreaField name="description" label="Briefly describe your agribusiness." required max={LIMITS.description} />
        <TextAreaField name="problem" label="What problem is your business solving?" required max={LIMITS.answer} />
        <TextAreaField name="solution" label="How does your product, service or innovation solve this problem?" required max={LIMITS.answer} />
        <TextAreaField name="originality" label="What makes your solution different from existing solutions?" required max={LIMITS.mid} rows={3} />
        <TextAreaField name="innovation" label="What is innovative about your approach?" required max={LIMITS.mid} rows={3} />
      </FormSection>

      <FormSection title="Customers and revenue" description="Ranges are fine. We do not need exact figures.">
        <TextAreaField name="mainCustomers" label="Who are your main customers?" required max={LIMITS.mid} rows={2} />
        <TextAreaField name="targetMarket" label="Who is your target market?" required max={LIMITS.mid} rows={2} />
        <NumberField name="customersServed" label="How many customers or users do you currently serve?" required />
        <RadioField name="generatesRevenue" label="Is the business currently generating revenue?" required options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "Not yet" }]} columns />
        {v.generatesRevenue === "YES" && (
          <div className="animate-rise space-y-5">
            <SelectField name="revenueRange" label="Approximate annual revenue" required options={REVENUE_RANGES.filter((r) => r.value !== "NONE")} />
            <TextField name="revenueSource" label="Main source of revenue" placeholder="e.g. sale of processed rice" />
          </div>
        )}
      </FormSection>

      <FormSection title="Employment">
        <Row><NumberField name="fullTime" label="Full-time employees" required /><NumberField name="partTime" label="Part-time employees" required /></Row>
        <Row><NumberField name="youthEmployed" label="Young people employed" required hint="Aged 18–35." /><NumberField name="womenEmployed" label="Women employed" required /></Row>
      </FormSection>

      <FormSection title="Reach so far" description="Your best estimates to date. Enter 0 if none.">
        <Row><NumberField name="farmersReached" label="Farmers reached" required /><NumberField name="jobsCreated" label="Jobs created" required /></Row>
        <Row><NumberField name="womenReached" label="Women reached" required /><NumberField name="youthReached" label="Youth reached" required /></Row>
        <NumberField name="communitiesReached" label="Rural communities reached" required />
      </FormSection>
    </div>
  );
}

export function StageImpact() {
  const v = useValues();
  return (
    <div className="space-y-10">
      <FormSection title="Social impact">
        <TextAreaField name="socialImpact" label="What measurable change has your business created?" required max={LIMITS.answer}
          hint="Use numbers where you can, e.g. “farmers’ income rose by about 20%”." />
        <TextAreaField name="beneficiaries" label="Who benefits most from your business?" required max={LIMITS.mid} rows={3} />
        <NumberField name="peopleBenefited" label="How many people or communities have benefited?" required />
      </FormSection>

      <FormSection title="Agricultural impact" description="Select what applies to your work.">
        <CheckboxGroupField name="agriImpactAreas" label="Your business…" options={AGRI_IMPACT_AREAS} />
        <TextAreaField name="environmentalImpact" label="Describe the change, with numbers if you have them" max={LIMITS.answer} rows={3} />
      </FormSection>

      <FormSection title="Support you need">
        <CheckboxGroupField name="supportNeeds" label="What support would help your business most?" required options={SUPPORT_NEEDS} />
        {Array.isArray(v.supportNeeds) && v.supportNeeds.includes("OTHER") && <TextField name="supportNeedsOther" label="Other — please specify" required />}
        <TextAreaField name="programmeGoal" label="What would participating in this programme help you achieve?" required max={LIMITS.mid} rows={3} />
      </FormSection>

      <FormSection title="Supporting material" description="Optional. Upload a file, or paste a link to one stored online (for example Google Drive or Dropbox). If you paste a link, make sure anyone with the link can view it.">
        {DOCUMENT_KINDS.map((d) => (
          <UploadField key={d.value} kind={d.value} label={d.label}
            name={{ PITCH_DECK: "docPitchDeck", BUSINESS_DOC: "docBusiness", REGISTRATION: "docRegistration", PRODUCT_IMAGES: "docImages", EVIDENCE: "docEvidence" }[d.value]} />
        ))}
      </FormSection>
    </div>
  );
}

export type { Values };
