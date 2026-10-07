"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField, CheckboxGroupField, FormCtx, FormSection, NumberField, RadioField, Row, SelectField, TextAreaField, TextField } from "@/components/application/fields";
import { UploadField } from "@/components/application/UploadField";
import { MENTOR_AREAS, MENTOR_AVAILABILITY } from "@/config/mentors";
import { NIGERIAN_STATES } from "@/config/programme";
import { validateMentor, type MentorErrors } from "@/lib/validation/mentor";
import { CopyReference } from "@/components/application/CopyReference";

/** MentorApplicationForm: one page, grouped sections, same field components as the applicant form. */
export function MentorApplicationForm() {
  const [values, setValues] = useState<Record<string, any>>({ expertise: [] });
  const [errors, setErrors] = useState<MentorErrors>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const uploadOwner = useMemo(() => Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join(""), []);

  const set = useCallback((n: string, v: unknown) => { setValues((p) => ({ ...p, [n]: v })); setErrors((e) => { if (!e[n]) return e; const { [n]: _x, ...r } = e; return r; }); }, []);
  const blur = useCallback(() => {}, []);
  const ctx = useMemo(() => ({ values, errors, set, blur }), [values, errors, set, blur]);

  async function submit() {
    if (busy) return;
    const r = validateMentor(values);
    if (!r.ok) {
      setErrors(r.errors); setNote(`Please fix ${Object.keys(r.errors).length} ${Object.keys(r.errors).length === 1 ? "field" : "fields"} below.`);
      requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>(`[data-field="${Object.keys(r.errors)[0]}"]`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true }); });
      return;
    }
    setBusy(true); setNote("");
    try {
      const res = await fetch("/api/mentors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, companyWebsite: honeypot.current?.value }) });
      const d = await res.json();
      if (res.status === 201) { setDone(d.mentorId); return; }
      if (d.errors) setErrors(d.errors);
      setNote(d.message ?? "We could not submit your application. Please try again.");
    } catch { setNote("We could not reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-card bg-lime p-8 text-night sm:p-10" role="status">
        <p className="text-xs font-bold uppercase tracking-[0.14em]">Thank you</p>
        <h3 className="mt-2 font-display text-3xl text-night">Your mentor application has been received.</h3>
        <p className="mt-3">Your reference number is:</p>
        <p className="mt-1 break-all font-mono text-2xl font-bold" data-testid="mentor-reference">{done}</p>
        <CopyReference value={done} />
        <p className="mt-4 text-sm">The programme team will review your application and be in touch. Keep this reference for any communication.</p>
      </div>
    );
  }

  return (
    <FormCtx.Provider value={ctx}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-10" aria-busy={busy}>
        <input ref={honeypot} name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {note && <div role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{note}</div>}

        <FormSection title="About you">
          <Row><TextField name="fullName" label="Full name" required autoComplete="name" /><TextField name="email" label="Email address" required type="email" inputMode="email" autoComplete="email" /></Row>
          <Row><TextField name="phone" label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" /><SelectField name="state" label="Where are you based?" required options={[...NIGERIAN_STATES, "Outside Nigeria"]} placeholder="Select" /></Row>
          <TextField name="location" label="City or town" required />
        </FormSection>

        <FormSection title="Professional background">
          <Row><TextField name="profession" label="Professional background or role" required /><TextField name="organization" label="Organisation" required /></Row>
          <Row><TextField name="industry" label="Industry" required /><NumberField name="yearsExperience" label="Years of experience" required /></Row>
          <TextAreaField name="mentorshipExperience" label="Your mentoring experience" required max={800} rows={4} hint="If you have not mentored before, write “None yet” and tell us what you could offer." />
        </FormSection>

        <FormSection title="How you can help">
          <CheckboxGroupField name="expertise" label="Areas you can mentor in" required hint="Select all that apply." options={MENTOR_AREAS} />
          <RadioField name="availability" label="How much time could you offer?" required options={MENTOR_AVAILABILITY} columns />
          <TextAreaField name="availabilityNotes" label="Anything we should know about your availability" max={500} rows={2} />
          <TextAreaField name="motivation" label="Why would you like to mentor?" required max={800} rows={4} />
        </FormSection>

        <FormSection title="Links and documents" description="All optional.">
          <Row><TextField name="linkedin" label="LinkedIn profile" type="url" inputMode="url" placeholder="https://" /><TextField name="portfolio" label="Portfolio or website" type="url" inputMode="url" placeholder="https://" /></Row>
          <UploadField name="docCv" label="CV or supporting document" kind="CV" scope="mentor" owner={uploadOwner} />
        </FormSection>

        <CheckboxField name="consent">I confirm the information above is accurate and I agree that the programme team may use it to assess my application and contact me.</CheckboxField>
        <div><Button type="button" onClick={submit} disabled={busy} className="!rounded-full !px-9 !py-4 text-base">{busy ? "Submitting…" : "Submit mentor application"}</Button></div>
      </form>
    </FormCtx.Provider>
  );
}
