"use client";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormCtx, FormSection, NumberField, RadioField, Row, SelectField, TextAreaField, TextField } from "@/components/application/fields";
import { NIGERIAN_STATES } from "@/config/programme";
import { L2_AGE, L2_CROPS, L2_DISABILITY, L2_EDUCATION, L2_GENDER, L2_NEEDS, L2_REGISTRATION, L2_SETTING, YES_NO } from "@/config/level2";
import { validateLevel2, type Level2Errors } from "@/lib/validation/level2";
import { ACCEPT_ATTR } from "@/lib/cloudinary/validate";

const MB = 1048576;
const EXTS = ["pdf", "png", "jpg", "jpeg", "webp", "docx", "pptx"];
const fmtSize = (b: number) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** An uploaded file is stored as a Cloudinary link or a "stored:" reference; anything else is a link the applicant pasted. */
const isUploaded = (v: unknown) => typeof v === "string" && (v.startsWith("stored:") || v.startsWith("https://res.cloudinary.com/"));

/** Phone photos are often 4–12 MB: shrink large images to a sharp, readable JPEG (max 2400 px) before uploading. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * MB || typeof createImageBitmap !== "function") return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" }) : file;
  } catch { return file; }
}

type UploadState = { kind: "idle" } | { kind: "uploading"; name: string; pct: number } | { kind: "error"; message: string; retry?: File };

/**
 * One document. Uploading is the main action (tap to choose, or drag a file here); pasting a link is the fallback.
 * Level 2 uploads carry the signed pass, so files land in that applicant's folder only.
 */
function DocField({ name, label, kind, pass, hint, required, maxMb, onExpired, onBusy }:
  { name: string; label: string; kind: string; pass: string; hint?: string; required?: boolean; maxMb: number; onExpired: () => void; onBusy: (name: string, busy: boolean) => void }) {
  const { values, errors, set } = useContext(FormCtx);
  const value: string = values[name] ?? "";
  const meta: { name: string; bytes: number } | undefined = values[`${name}__file`];
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const [st, setSt] = useState<UploadState>({ kind: "idle" });
  const [linkMode, setLinkMode] = useState(() => !!value && !isUploaded(value));
  const [drag, setDrag] = useState(false);
  const id = `file-${name}`, errId = `f-${name}-err`, hintId = `f-${name}-hint`;

  async function pick(chosen: File) {
    const ext = (chosen.name.split(".").pop() || "").toLowerCase();
    if (!EXTS.includes(ext)) {
      setSt({ kind: "error", message: /^(heic|heif)$/.test(ext) ? "iPhone HEIC photos cannot be read. Please choose a JPG photo, or a PDF." : "That file type is not accepted. Please choose a PDF, a photo (JPG, PNG), or a Word or PowerPoint file." });
      return;
    }
    const file = await shrinkImage(chosen);
    if (file.size > maxMb * MB) { setSt({ kind: "error", message: `That file is ${fmtSize(file.size)}. The limit is ${maxMb} MB: please choose a smaller file, or paste a link instead.` }); return; }
    setSt({ kind: "uploading", name: file.name, pct: 0 }); onBusy(name, true);
    const body = new FormData(); body.set("file", file); body.set("scope", "level2"); body.set("kind", kind); body.set("pass", pass);
    const req = new XMLHttpRequest(); xhr.current = req;
    req.open("POST", "/api/uploads"); req.responseType = "json";
    req.upload.onprogress = (e) => { if (e.lengthComputable) setSt({ kind: "uploading", name: file.name, pct: Math.min(99, Math.round((e.loaded / e.total) * 100)) }); };
    const done = () => { xhr.current = null; onBusy(name, false); if (input.current) input.current.value = ""; };
    req.onload = () => {
      done();
      const d = (req.response ?? {}) as { url?: string; message?: string };
      if (req.status === 401) { setSt({ kind: "error", message: d.message ?? "Your session has expired." }); onExpired(); return; }
      if (req.status < 200 || req.status >= 300 || !d.url) {
        setSt({ kind: "error", message: d.message ?? (req.status === 429 ? "Too many uploads in a short time. Please wait a few minutes and try again." : "The upload did not go through. Please try again."), retry: req.status >= 500 || req.status === 429 || req.status === 0 ? file : undefined });
        return;
      }
      set(name, d.url); set(`${name}__file`, { name: file.name, bytes: file.size }); setLinkMode(false); setSt({ kind: "idle" });
    };
    req.onerror = () => { done(); setSt({ kind: "error", message: "The connection dropped during the upload. Check your internet connection and try again.", retry: file }); };
    req.onabort = () => { done(); setSt({ kind: "idle" }); };
    req.send(body);
  }
  const remove = () => { set(name, ""); set(`${name}__file`, undefined); setSt({ kind: "idle" }); };
  const error = st.kind === "error" ? st.message : errors[name];
  const uploaded = isUploaded(value);
  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <div className="space-y-2" data-field={name}>
      <p className="block text-[15px] font-medium text-forest-900" id={`${id}-label`}>
        {label}{required ? <><span className="text-danger-fg" aria-hidden="true"> *</span><span className="sr-only"> (required)</span></> : <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>}
      </p>
      {hint && <p id={hintId} className="text-sm text-ink-muted">{hint}</p>}
      <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" id={id} tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />

      {st.kind === "uploading" ? (
        <div className="rounded-lg border border-paper-line bg-white p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{st.name}</span><span className="shrink-0 tabular-nums text-ink-muted">{st.pct}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-line"><div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${st.pct}%` }} /></div>
          <button type="button" onClick={() => xhr.current?.abort()} className="mt-2 text-sm font-semibold text-ink-soft underline">Cancel</button>
        </div>
      ) : uploaded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-leaf-50 px-4 py-3">
          <p className="min-w-0 text-sm"><span className="mr-1.5 font-bold text-primary" aria-hidden="true">✓</span><span className="font-medium">{meta?.name ?? "File uploaded"}</span>
            {meta && <span className="text-ink-muted tabular-nums"> · {fmtSize(meta.bytes)}</span>}<span className="sr-only"> uploaded</span></p>
          <div className="flex gap-2">
            <button type="button" onClick={() => input.current?.click()} className={`${btn} min-h-[36px] border border-paper-line bg-white px-4 py-1 text-ink`}>Replace</button>
            <button type="button" onClick={remove} className={`${btn} min-h-[36px] px-3 py-1 text-danger-fg`} aria-label={`Remove ${meta?.name ?? "file"}`}>Remove</button>
          </div>
        </div>
      ) : linkMode ? (
        <div className="space-y-2">
          <input type="url" inputMode="url" value={value} onChange={(e) => set(name, e.target.value)} placeholder="https://drive.google.com/…" aria-labelledby={`${id}-label`}
            aria-invalid={!!error} aria-describedby={[hint ? hintId : "", error ? errId : ""].filter(Boolean).join(" ") || undefined} className={`input-base ${error ? "input-error" : ""}`} />
          <p className="text-xs text-ink-muted">Make sure anyone with the link can view the file.{" "}
            <button type="button" onClick={() => { set(name, ""); setLinkMode(false); }} className="font-semibold text-primary underline">Upload a file instead</button></p>
        </div>
      ) : (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void pick(f); }}
          className={`rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${drag ? "border-primary bg-leaf-50" : error ? "border-danger-line bg-white" : "border-paper-line bg-white"}`}>
          <button type="button" onClick={() => input.current?.click()} aria-describedby={[`${id}-types`, error ? errId : ""].filter(Boolean).join(" ")}
            className={`${btn} bg-primary text-white hover:bg-primary/90`}>Choose a file</button>
          <p id={`${id}-types`} className="mt-2 text-xs text-ink-muted">PDF, photo (JPG, PNG), Word or PowerPoint · up to {maxMb} MB<span className="hidden sm:inline"> · or drag the file here</span></p>
          <p className="mt-1 text-xs text-ink-muted">You can take a clear photo of a paper document. Large photos are made smaller automatically.</p>
        </div>
      )}

      {!uploaded && !linkMode && st.kind !== "uploading" && (
        <button type="button" onClick={() => { setLinkMode(true); setSt({ kind: "idle" }); }} className="text-sm font-semibold text-primary underline">Paste a link instead (Google Drive, Dropbox…)</button>
      )}
      {error && (
        <p id={errId} role="alert" className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-danger-fg"><span aria-hidden="true">!</span>{error}
          {st.kind === "error" && st.retry && <button type="button" onClick={() => void pick(st.retry!)} className="font-semibold underline">Try again</button>}</p>
      )}
    </div>
  );
}

export function Level2Form({ uploadMaxMb = 8 }: { uploadMaxMb?: number }) {
  const [step, setStep] = useState<"start" | "form" | "done">("start");
  const [code, setCode] = useState(""); const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Level2Errors>({});
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const onBusy = useCallback((n: string, b: boolean) => setUploading((u) => (b ? [...u.filter((x) => x !== n), n] : u.filter((x) => x !== n))), []);
  const expired = useCallback(() => {
    setPass(""); setStep("start");
    setNote("Your session has expired. Enter your code and email again to continue: your answers and uploaded files are kept.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
    if (uploading.length) { setNote("Please wait until your files have finished uploading."); return; }
    const r = validateLevel2(values);
    if (!r.ok) {
      setErrors(r.errors); const n = Object.keys(r.errors).length; setNote(`Please fix ${n} ${n === 1 ? "field" : "fields"} below.`);
      requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>(`[data-field="${Object.keys(r.errors)[0]}"]`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.querySelector<HTMLElement>("input:not([type=file]),select,textarea,button")?.focus({ preventScroll: true }); });
      return;
    }
    setBusy(true); setNote("");
    try {
      const res = await fetch("/api/level-2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pass, values: Object.fromEntries(Object.entries(values).filter(([k]) => !k.endsWith("__file"))), companyWebsite: honeypot.current?.value }) });
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
  const docProps = { maxMb: uploadMaxMb, onExpired: expired, onBusy };
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

        <FormSection title="Documents" description="Choose each file from your phone or computer, or take a photo of a paper document. If a file is too large, you can paste a link to it instead (for example a Google Drive link that anyone with the link can view).">
          <DocField name="doc1" label="Supporting document: business proposal, pitch deck or EOP (economics of production)" kind="L2_SUPPORTING" pass={pass} required {...docProps} />
          <DocField name="doc2" label="Another supporting document" kind="L2_SUPPORTING" pass={pass} {...docProps} />
          <DocField name="doc3" label="Another supporting document" kind="L2_SUPPORTING" pass={pass} {...docProps} />
          <DocField name="cacCertificate" label="Business registration: CAC certificate" kind="L2_CAC" pass={pass} required={v.hasCac === "YES"} {...docProps} hint={v.hasCac === "YES" ? "Required, because the SME has a CAC certificate." : "If the SME has one."} />
          <DocField name="smedanCertificate" label="Business registration: SMEDAN certificate" kind="L2_SMEDAN" pass={pass} {...docProps} />
          {v.hasBusinessBankAccount === "YES" && <DocField name="bankProof" label="Business bank account: proof, e.g. bank reference letter or statement header" kind="L2_BANK" pass={pass} {...docProps} hint="Hide full account numbers if you prefer. Never share passwords or PINs." />}
        </FormSection>

        <div className="space-y-3">
          <CheckboxField name="declaration">I confirm the information in this Level 2 application is true, and I agree that the programme team may verify it and the documents provided.</CheckboxField>
          <Button type="button" onClick={submit} disabled={busy || uploading.length > 0} className="w-full sm:w-auto">{busy ? "Submitting…" : uploading.length ? "Waiting for uploads…" : "Submit Level 2 application"}</Button>
        </div>
      </form>
    </FormCtx.Provider>
  );
}
