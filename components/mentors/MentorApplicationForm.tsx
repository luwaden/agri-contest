"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField, CheckboxGroupField, FormCtx, FormSection, NumberField, RadioField, Row, SelectField, TextAreaField, TextField } from "@/components/application/fields";
import { PANEL_AVAILABILITY, PANEL_EXPERTISE, PANEL_ROLES } from "@/config/mentors";
import { NIGERIAN_STATES } from "@/config/programme";
import { validateMentor, type MentorErrors } from "@/lib/validation/mentor";
import { CopyReference } from "@/components/application/CopyReference";

/** Short application for mentors, judges and reviewers. Same field components as the applicant form. */
export function MentorApplicationForm() {
  const [values, setValues] = useState<Record<string, any>>({ expertise: [] });
  const [errors, setErrors] = useState<MentorErrors>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

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
        <h3 className="mt-2 font-display text-3xl text-night">Your application has been received.</h3>
        <p className="mt-3">Your reference number is:</p>
        <p className="mt-1 break-all font-mono text-2xl font-bold" data-testid="mentor-reference">{done}</p>
        <CopyReference value={done} />
        <p className="mt-4 text-sm">The programme team will review your application and be in touch. Keep this reference for any communication.</p>
      </div>
    );
  }

  const wantsScoring = values.role === "JUDGE" || values.role === "REVIEWER";
  return (
    <FormCtx.Provider value={ctx}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-9" aria-busy={busy}>
        <input ref={honeypot} name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {note && <div role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{note}</div>}

        <FormSection title="How would you like to help?">
          <RadioField name="role" label="I would like to serve as" required hint="Choose one." options={PANEL_ROLES.map((r) => ({ value: r.value, label: r.label, hint: r.hint }))} />
          <CheckboxGroupField name="expertise" label="My areas of expertise" required options={PANEL_EXPERTISE} />
          <RadioField name="availability" label="Time I could offer" required options={PANEL_AVAILABILITY} columns />
        </FormSection>

        <FormSection title="About you">
          <Row><TextField name="firstName" label="First name" required autoComplete="given-name" /><TextField name="lastName" label="Surname" required autoComplete="family-name" /></Row>
          <Row><TextField name="email" label="Email address" required type="email" inputMode="email" autoComplete="email" /><TextField name="phone" label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" /></Row>
          <Row><SelectField name="state" label="Where are you based?" required options={[...NIGERIAN_STATES, "Outside Nigeria"]} placeholder="Select" /><TextField name="linkedin" label="LinkedIn profile" required type="url" inputMode="url" autoComplete="url" placeholder="https://www.linkedin.com/in/your-name" /></Row>
          <Row><TextField name="profession" label="Current role and organisation" required placeholder="e.g. Agri-finance manager, AgriBank" /><NumberField name="yearsExperience" label="Years of experience" required /></Row>
        </FormSection>

        <FormSection title="Optional">
          <TextAreaField name="motivation" label="Anything else you would like us to know" max={500} rows={3} />
        </FormSection>

        <div className="space-y-3">
          {wantsScoring && <CheckboxField name="coi">As a judge or reviewer, I will declare any personal, commercial, advisory or investment relationship with an applicant and will not score that entry.</CheckboxField>}
          <CheckboxField name="consent">I confirm the information above is accurate and agree that the programme team may use it to assess my application and contact me.</CheckboxField>
        </div>
        <div><Button type="button" onClick={submit} disabled={busy} className="!rounded-full !px-9 !py-4 text-base">{busy ? "Submitting…" : "Submit application"}</Button></div>
      </form>
    </FormCtx.Provider>
  );
}
