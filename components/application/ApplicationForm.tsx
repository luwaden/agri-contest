"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateAll, validateStage, type FieldErrors } from "@/lib/validation/application";
import { Button } from "@/components/ui/Button";
import { FormCtx, type Values } from "./fields";
import { ProgressStepper } from "./ProgressStepper";
import { StageBusiness, StageImpact, StageProfile } from "./stages";
import { Review } from "./Review";
import { clearUploadSession } from "@/lib/uploadSession";

const LS_KEY = "agri-contest.application.v1";
const TITLES = [
  { h: "Applicant profile", p: "Tell us about yourself. This takes about five minutes." },
  { h: "Agribusiness and innovation", p: "This is the core of your application. Take your time." },
  { h: "Impact, inclusion and support", p: "Almost there. Then you will review everything before submitting." },
];
const REVIEW = 3;

export function ApplicationForm({ resumeToken }: { resumeToken?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ nationality: "Nigerian", languages: [], agriImpactAreas: [], supportNeeds: [] });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [stage, setStage] = useState(0);
  const [token, setToken] = useState<string | undefined>();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [declarationError, setDeclarationError] = useState<string | undefined>();
  const heading = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  // Restore progress: server draft via ?resume=, otherwise this device's saved copy.
  useEffect(() => {
    (async () => {
      try {
        if (resumeToken) {
          const r = await fetch(`/api/applications/draft?token=${encodeURIComponent(resumeToken)}`);
          if (r.ok) {
            const d = await r.json();
            setValues((v) => ({ ...v, ...d.values })); setStage(Math.min(d.stage ?? 0, 2)); setToken(resumeToken);
            setNote({ kind: "ok", text: "Welcome back. Your saved application has been restored." });
          } else setNote({ kind: "error", text: (await r.json()).message });
        } else {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            setValues((v) => ({ ...v, ...d.values })); setStage(Math.min(d.stage ?? 0, 2)); setToken(d.token);
            setNote({ kind: "ok", text: "We restored the answers you saved on this device." });
          }
        }
      } catch { /* storage unavailable: continue with a blank form */ }
      setReady(true);
    })();
  }, [resumeToken]);

  // Debounced local auto-save
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ values, stage: Math.min(stage, 2), token })); } catch {} }, 600);
    return () => clearTimeout(t);
  }, [values, stage, token, ready]);

  const set = useCallback((name: string, v: unknown) => {
    setValues((p) => ({ ...p, [name]: v }));
    setErrors((e) => { if (!e[name]) return e; const { [name]: _, ...rest } = e; return rest; });
  }, []);

  const blur = useCallback((name: string) => {
    if (stage > 2) return;
    setValues((cur) => {
      if (String(cur[name] ?? "").trim() !== "") {
        const r = validateStage(stage as 0 | 1 | 2, cur);
        if (!r.ok && r.errors[name]) setErrors((e) => ({ ...e, [name]: r.errors[name] }));
      }
      return cur;
    });
  }, [stage]);

  const ctx = useMemo(() => ({ values, errors, set, blur }), [values, errors, set, blur]);

  const goTo = (s: number) => {
    setStage(s); setNote(null); setErrors({});
    requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: "smooth" }); heading.current?.focus({ preventScroll: true }); });
  };

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs)[0];
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true });
    });
  };

  async function saveDraft(silent = false) {
    setSaving(true);
    try {
      const r = await fetch("/api/applications/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, values, stage: Math.min(stage, 2) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setToken(d.token);
      try { localStorage.setItem(LS_KEY, JSON.stringify({ values, stage: Math.min(stage, 2), token: d.token })); } catch {}
      if (!silent) setNote({ kind: "ok", text: "Your progress has been saved. You can return to this device and continue at any time." });
      return d.token as string;
    } catch (e) {
      setNote({ kind: "error", text: `${(e as Error).message || "We could not save to our servers."} Your answers are still stored on this device.` });
    } finally { setSaving(false); }
  }

  function next() {
    const r = validateStage(stage as 0 | 1 | 2, values);
    if (!r.ok) {
      setErrors(r.errors); setNote({ kind: "error", text: `Please fix ${Object.keys(r.errors).length} ${Object.keys(r.errors).length === 1 ? "field" : "fields"} below to continue.` });
      focusFirstError(r.errors); return;
    }
    if (stage === 1 || stage === 0) void saveDraft(true);
    goTo(stage + 1);
  }

  async function submit() {
    if (submitting) return;
    const r = validateAll(values);
    if (!r.ok) {
      const badStage = r.errors.findIndex((e) => Object.keys(e).length > 0);
      if (badStage !== -1) { goTo(badStage); setTimeout(() => { setErrors(r.errors[badStage]); setNote({ kind: "error", text: "Some answers need attention before you can submit." }); focusFirstError(r.errors[badStage]); }, 50); return; }
      setErrors({ declaration: r.declarationError! }); setDeclarationError(r.declarationError);
      document.querySelector('[data-field="declaration"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true); setNote(null);
    try {
      const res = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, draftToken: token, companyWebsite: honeypot.current?.value }) });
      const data = await res.json();
      if (res.status === 201) { try { localStorage.removeItem(LS_KEY); } catch {} clearUploadSession(); router.push(`/apply/success?ref=${encodeURIComponent(data.applicationId)}`); return; }
      if (res.status === 422 && data.errors) {
        const badStage = (data.errors as FieldErrors[]).findIndex((e) => e && Object.keys(e).length);
        if (badStage !== -1) { goTo(badStage); setTimeout(() => { setErrors(data.errors[badStage]); focusFirstError(data.errors[badStage]); }, 50); }
      }
      setNote({ kind: "error", text: data.message ?? "We could not submit your application. Please try again." });
    } catch { setNote({ kind: "error", text: "We could not reach the server. Check your connection and try again. Your answers are saved on this device." }); }
    finally { setSubmitting(false); }
  }

  const inReview = stage === REVIEW;
  return (
    <FormCtx.Provider value={ctx}>
      <form onSubmit={(e) => e.preventDefault()} noValidate aria-busy={submitting}>
        <ProgressStepper current={stage} />
        <input ref={honeypot} name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        <div key={stage} className="animate-rise">
          {!inReview ? (
            <header className="mb-8">
              <p className="eyebrow">Step {stage + 1} of 3</p>
              <h2 ref={heading} tabIndex={-1} className="mt-1 font-display text-3xl font-extrabold outline-none sm:text-4xl">{TITLES[stage].h}</h2>
              <p className="mt-2 text-ink-soft">{TITLES[stage].p} Fields marked <span className="text-danger-fg">*</span> are required.</p>
            </header>
          ) : <h2 ref={heading} tabIndex={-1} className="sr-only">Review your application</h2>}

          {note && (
            <div role={note.kind === "error" ? "alert" : "status"} className={`mb-6 rounded-md border px-4 py-3 text-sm font-medium ${note.kind === "error" ? "border-danger-line bg-danger-bg text-danger-fg" : "border-leaf-200 bg-leaf-50 text-leaf-900"}`}>{note.text}</div>
          )}

          {stage === 0 && <StageProfile />}
          {stage === 1 && <StageBusiness />}
          {stage === 2 && <StageImpact />}
          {inReview && <Review values={values} onEdit={goTo} declarationError={declarationError} />}
        </div>

        <div className="sticky bottom-0 -mx-5 mt-10 border-t border-paper-line bg-white/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none no-print">
          <div className="flex flex-wrap items-center gap-3">
            {stage > 0 && <Button type="button" variant="secondary" onClick={() => goTo(stage - 1)}>Back</Button>}
            {!inReview && <Button type="button" variant="ghost" onClick={() => saveDraft()} disabled={saving}>{saving ? "Saving…" : "Save progress"}</Button>}
            <div className="ml-auto">
              {stage < 2 && <Button type="button" onClick={next}>Continue</Button>}
              {stage === 2 && <Button type="button" onClick={next}>Review application</Button>}
              {inReview && <Button type="button" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit Application"}</Button>}
            </div>
          </div>
        </div>
      </form>
    </FormCtx.Provider>
  );
}
