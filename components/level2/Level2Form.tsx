"use client";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormCtx, FormSection, NumberField, RadioField, Row, SelectField, TextAreaField, TextField } from "@/components/application/fields";
import { NIGERIAN_STATES } from "@/config/programme";
import { L2_AGE, L2_CROPS, L2_DISABILITY, L2_EDUCATION, L2_GENDER, L2_NEEDS, L2_REGISTRATION, L2_SETTING, YES_NO } from "@/config/level2";
import { validateLevel2, type Level2Errors } from "@/lib/validation/level2";
import { ACCEPT_ATTR } from "@/lib/cloudinary/validate";

type Upload = { kind: "idle" } | { kind: "uploading"; name: string } | { kind: "done"; name: string } | { kind: "error"; message: string };

/** A link field that can be filled by uploading a file. Level 2 uploads carry the signed pass. */
function DocField({ name, label, kind, pass, hint, required }: { name: string; label: string; kind: string; pass: string; hint?: string; required?: boolean }) {
  const { set } = useContext(FormCtx);
  const input = useRef<HTMLInputElement>(null);
  const [st, setSt] = useState<Upload>({ kind: "idle" });
  async function pick(file: File) {
    setSt({ kind: "uploading", name: file.name });
    try {
      const body = new FormData(); body.set("file", file); body.set("scope", "level2"); body.set("kind", kind); body.set("pass", pass);
      const r = await fetch("/api/uploads", { method: "POST", body }); const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "The upload did not go through. Please try again.");
      set(name, d.url); setSt({ kind: "done", name: file.name });
    } catch (e) { setSt({ kind: "error", message: (e as Error).message }); } finally { if (input.current) input.current.value = ""; }
  }
  return (
    <div className="space-y-2" data-field={name}>
      <TextField name={name} label={label} required={required} type="url" inputMode="url" placeholder="Upload a file below, or paste a link (https://…)" hint={hint} />
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" id={`file-${name}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
        <label htmlFor={`file-${name}`} className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border-2 border-primary px-5 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${st.kind === "uploading" ? "pointer-events-none opacity-60" : ""}`}>
          {st.kind === "uploading" ? "Uploading…" : "Upload a file"}</label>
        <span className="text-xs text-ink-muted">PDF, image, Word or PowerPoint · up to 8 MB</span>
      </div>
      <p role="status" aria-live="polite" className={`text-sm font-medium ${st.kind === "error" ? "text-danger-fg" : "text-primary"}`}>
        {st.kind === "uploading" && `Uploading ${st.name}…`}{st.kind === "done" && `Uploaded: ${st.name}.`}{st.kind === "error" && st.message}</p>
    </div>
  );
}

export function Level2Form() {
  const [step, setStep] = useState<"start" | "form" | "done">("start");
  const [code, setCode] = useState(""); const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Level2Errors>({});
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = useCallback((n: string, v: unknown) => { setValues((p) => ({ ...p, [n]: v })); setErrors((e) => { if (!e[n]) return e; const { [n]: _x, ...r } = e; return r; }); }, []);
  const blur = useCallback(() => {}, []);
  const ctx = useMemo(() => ({ values, errors, set, blur }), [values, errors, set, blur]);

  async function start(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setNote("");
    try {
      const res = await fetch("/api/level-2/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, email }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setNote(d.message ?? "We could not check your code. Please try again."); return; }
      setPass(d.token); setCode(d.code);
      setValues((v) => ({ ...d.prefill, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x != null)) }));   // keep anything already typed
      setStep("form"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setNote("We could not reach the server. Check your connection and try again."); } finally { setBusy(false); }
  }

  async function submit() {
    if (busy) return;
    const r = validateLevel2(values);
    if (!r.ok) {
      setErrors(r.errors); const n = Object.keys(r.errors).length; setNote(`Please fix ${n} ${n === 1 ? "field" : "fields"} below.`);
      requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>(`[data-field="${Object.keys(r.errors)[0]}"]`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true }); });
      return;
    }
    setBusy(true); setNote("");
    try {
      const res = await fetch("/api/level-2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pass, values, companyWebsite: honeypot.current?.value }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 201) { setStep("done"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (d.code === "PASS_EXPIRED") { setStep("start"); setPass(""); }
      if (d.errors) setErrors(d.errors);
      setNote(d.message ?? "We could not submit your application. Please try again.");
    } catch { setNote("We could not reach the server. Check your connection and try again."); } finally { setBusy(false); }
  }

  const alert = note && <div role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{note}</div>;

  if (step === "done") return (
    <div className="rounded-card bg-lime p-8 text-night sm:p-10" role="status">
      <p className="text-xs font-bold uppercase tracking-[0.14em]">Thank you</p>
      <h2 className="mt-2 font-display text-3xl text-night">Your Level 2 application has been received.</h2>
      <p className="mt-3">It is filed under your Level 1 code:</p>
      <p className="mt-1 break-all font-mono text-2xl font-bold">{code}</p>
      <p className="mt-4 text-sm">A confirmation is on its way to {values.email} (check the Spam folder too). The programme team will contact you about the next step.</p>
    </div>
  );

  if (step === "start") return (
    <form onSubmit={start} className="space-y-5 rounded-card border border-paper-line bg-white p-6 sm:p-8" aria-busy={busy}>
      <div><h2 className="font-display text-2xl font-extrabold text-primary">Start with your Level 1 details</h2>
        <p className="mt-1 text-ink-soft">Use the application code from your Level 1 confirmation email, and the same email address you used then.</p></div>
      {alert}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-[15px] font-medium">Level 1 application code <span className="text-danger-fg">*</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoComplete="off" spellCheck={false} placeholder="AGRA-2026-K7QX4M" className="input-base mt-1.5 font-mono uppercase" /></label>
        <label className="block text-[15px] font-medium">Email address used at Level 1 <span className="text-danger-fg">*</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" inputMode="email" autoComplete="email" className="input-base mt-1.5" /></label>
      </div>
      <Button type="submit" disabled={busy || !code.trim() || !email.trim()}>{busy ? "Checking…" : "Continue"}</Button>
    </form>
  );

  const v = values;
  return (
    <FormCtx.Provider value={ctx}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-9" aria-busy={busy}>
        <input ref={honeypot} name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <div className="rounded-md bg-leaf-50 px-4 py-3 text-sm text-forest-900">Level 1 code <strong className="font-mono">{code}</strong>. Answers we already had from Level 1 are filled in: please check them and correct anything that has changed.</div>
        {alert}

        <FormSection title="The business and its owner">
          <Row><TextField name="businessName" label="Business name" required /><NumberField name="yearEstablished" label="Year of establishment" required /></Row>
          <TextField name="contactName" label="Name of contact person (Founder/CEO)" required autoComplete="name" />
          <Row><TextField name="phone" label="Telephone number (preferably WhatsApp)" required type="tel" inputMode="tel" autoComplete="tel" /><TextField name="email" label="Email address" required type="email" inputMode="email" autoComplete="email" /></Row>
          <Row><SelectField name="state" label="State" required options={[...NIGERIAN_STATES]} placeholder="Select" /><TextField name="lga" label="Local Government Area (LGA)" required /></Row>
          <TextField name="community" label="Community / village / ward" required />
          <RadioField name="setting" label="Is the business in a rural or urban area?" required options={L2_SETTING} columns />
          <RadioField name="ownerGender" label="Gender of owner" required options={L2_GENDER} columns />
          <RadioField name="ownerAge" label="Age of owner" required options={L2_AGE} columns />
          <RadioField name="disability" label="Disability status: does the owner have a disability?" required options={L2_DISABILITY} columns />
          <SelectField name="ownerEducation" label="Owner's highest educational level" required options={L2_EDUCATION} placeholder="Select" />
        </FormSection>

        <FormSection title="Operations">
          <RadioField name="cropType" label="Crop type" required options={L2_CROPS} columns />
          {v.cropType === "OTHER" && <TextField name="cropTypeOther" label="Which crop?" required />}
          <RadioField name="hasCac" label="Does the SME have a Corporate Affairs Commission (CAC) certificate?" required options={YES_NO} columns />
          <RadioField name="registrationType" label="Type of registration" required options={L2_REGISTRATION} columns />
          {v.registrationType === "OTHER" && <TextField name="registrationTypeOther" label="Please describe the type of registration" required />}
          <Row><NumberField name="permanentEmployees" label="Number of permanent employees" required /><NumberField name="casualEmployees" label="Number of casual employees" required /></Row>
          <NumberField name="farmersServed" label="Approximate number of farmers served in a year" required />
          <RadioField name="trainedInputDistribution" label="Has the SME/owner received training on input distribution?" required options={YES_NO} columns />
          <RadioField name="inAssociation" label="Does the owner belong to an association?" required options={YES_NO} columns />
          {v.inAssociation === "YES" && <TextField name="associationName" label="Name of the association" required />}
          <RadioField name="agraSupport" label="Did the SME receive any support from AGRA-funded projects?" required options={YES_NO} columns />
          <RadioField name="hasBusinessBankAccount" label="Does the SME have a business bank account?" required options={YES_NO} columns hint="Never share account passwords or PINs." />
        </FormSection>

        <FormSection title="Support the SME needs">
          {L2_NEEDS.map(([n, label]) => <RadioField key={n} name={n} label={label} required options={YES_NO} columns />)}
          <RadioField name="hasOtherNeeds" label="Does the SME have other business needs?" required options={YES_NO} columns />
          {v.hasOtherNeeds === "YES" && <TextAreaField name="otherNeeds" label="Please state the other needs" required max={600} rows={3} />}
        </FormSection>

        <FormSection title="Documents" description="Upload each file, or paste a link to it (for example a Google Drive link that anyone with the link can view).">
          <DocField name="doc1" label="Supporting document: business proposal, pitch deck or EOP (economics of production)" kind="L2_SUPPORTING" pass={pass} required />
          <DocField name="doc2" label="Another supporting document" kind="L2_SUPPORTING" pass={pass} />
          <DocField name="doc3" label="Another supporting document" kind="L2_SUPPORTING" pass={pass} />
          <DocField name="cacCertificate" label="Business registration: CAC certificate" kind="L2_CAC" pass={pass} required={v.hasCac === "YES"} hint={v.hasCac === "YES" ? "Required, because the SME has a CAC certificate." : "If the SME has one."} />
          <DocField name="smedanCertificate" label="Business registration: SMEDAN certificate" kind="L2_SMEDAN" pass={pass} />
          {v.hasBusinessBankAccount === "YES" && <DocField name="bankProof" label="Business bank account: proof, e.g. bank reference letter or statement header" kind="L2_BANK" pass={pass} hint="Hide full account numbers if you prefer. Never share passwords or PINs." />}
        </FormSection>

        <div className="space-y-3">
          <CheckboxField name="declaration">I confirm the information in this Level 2 application is true, and I agree that the programme team may verify it and the documents provided.</CheckboxField>
          <Button type="button" onClick={submit} disabled={busy} className="w-full sm:w-auto">{busy ? "Submitting…" : "Submit Level 2 application"}</Button>
        </div>
      </form>
    </FormCtx.Provider>
  );
}
