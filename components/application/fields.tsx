"use client";
import { createContext, useContext, type ReactNode } from "react";

export type Values = Record<string, any>;
interface Ctx { values: Values; errors: Record<string, string>; set: (name: string, v: unknown) => void; blur: (name: string) => void }
export const FormCtx = createContext<Ctx>(null as unknown as Ctx);
const useForm = () => useContext(FormCtx);

interface Base { name: string; label: string; hint?: string; required?: boolean }
const ids = (name: string) => ({ id: `f-${name}`, hintId: `f-${name}-hint`, errId: `f-${name}-err` });

function Shell({ name, label, hint, required, children, legend = false }: Base & { children: ReactNode; legend?: boolean }) {
  const { errors } = useForm();
  const { id, hintId, errId } = ids(name);
  const error = errors[name];
  const Head = legend ? "legend" : "label";
  return (
    <div className="space-y-1.5" data-field={name}>
      <Head {...(legend ? {} : { htmlFor: id })} className="block text-[15px] font-medium text-forest-900">
        {label}{required ? <span className="text-danger-fg" aria-hidden="true"> *</span> : <span className="ml-1.5 text-xs font-normal text-ink-muted">optional</span>}
        {required && <span className="sr-only"> (required)</span>}
      </Head>
      {hint && <p id={hintId} className="text-sm text-ink-muted">{hint}</p>}
      {children}
      {error && <p id={errId} role="alert" className="flex gap-1.5 text-sm font-medium text-danger-fg"><span aria-hidden="true">!</span>{error}</p>}
    </div>
  );
}
const describe = (name: string, hint?: string, error?: string) => [hint ? ids(name).hintId : "", error ? ids(name).errId : ""].filter(Boolean).join(" ") || undefined;

export function TextField({ name, label, hint, required, type = "text", inputMode, autoComplete, placeholder, list, readOnly }:
  Base & { type?: string; inputMode?: "text" | "numeric" | "tel" | "email" | "url"; autoComplete?: string; placeholder?: string; list?: string; readOnly?: boolean }) {
  const { values, errors, set, blur } = useForm();
  return (
    <Shell {...{ name, label, hint, required }}>
      <input id={ids(name).id} name={name} type={type} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder} list={list} readOnly={readOnly}
        value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} onBlur={() => blur(name)}
        aria-invalid={!!errors[name]} aria-required={required} aria-describedby={describe(name, hint, errors[name])}
        className={`input-base ${errors[name] ? "input-error" : ""} ${readOnly ? "bg-neutral-50" : ""}`} />
    </Shell>
  );
}

export function NumberField(props: Omit<Base, "hint"> & { hint?: string }) {
  return <TextField {...props} type="text" inputMode="numeric" placeholder="0" />;
}

export function TextAreaField({ name, label, hint, required, max, rows = 4 }: Base & { max: number; rows?: number }) {
  const { values, errors, set, blur } = useForm();
  const len = String(values[name] ?? "").length;
  return (
    <Shell {...{ name, label, hint, required }}>
      <textarea id={ids(name).id} name={name} rows={rows} value={values[name] ?? ""} maxLength={max + 200}
        onChange={(e) => set(name, e.target.value)} onBlur={() => blur(name)}
        aria-invalid={!!errors[name]} aria-required={required} aria-describedby={describe(name, hint, errors[name])}
        className={`input-base resize-y leading-relaxed ${errors[name] ? "input-error" : ""}`} />
      <p className={`text-right text-xs tabular-nums ${len > max ? "font-semibold text-danger-fg" : "text-ink-muted"}`} aria-live="polite">
        {len} / {max}{len > max ? " (too long)" : ""}
      </p>
    </Shell>
  );
}

export function SelectField({ name, label, hint, required, options, placeholder = "Select…" }:
  Base & { options: ReadonlyArray<string | { value: string; label: string }>; placeholder?: string }) {
  const { values, errors, set, blur } = useForm();
  return (
    <Shell {...{ name, label, hint, required }}>
      <select id={ids(name).id} name={name} value={values[name] ?? ""} onChange={(e) => set(name, e.target.value)} onBlur={() => blur(name)}
        aria-invalid={!!errors[name]} aria-required={required} aria-describedby={describe(name, hint, errors[name])}
        className={`input-base appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22 fill=%22none%22 stroke=%22%2365726a%22 stroke-width=%222%22><path d=%22M5 8l5 5 5-5%22/></svg>')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 ${errors[name] ? "input-error" : ""}`}>
        <option value="">{placeholder}</option>
        {options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return <option key={v} value={v}>{l}</option>; })}
      </select>
    </Shell>
  );
}

/** Radio options as large, tappable rows. */
export function RadioField({ name, label, hint, required, options, columns = false }:
  Base & { options: ReadonlyArray<{ value: string; label: string; hint?: string }>; columns?: boolean }) {
  const { values, errors, set } = useForm();
  return (
    <fieldset aria-describedby={describe(name, hint, errors[name])}>
      <Shell {...{ name, label, hint, required, legend: true }}>
        <div role="radiogroup" className={`grid gap-2 ${columns ? "sm:grid-cols-2" : ""}`}>
          {options.map((o) => {
            const on = values[name] === o.value;
            return (
              <label key={o.value} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 transition-colors ${on ? "border-leaf-600 bg-leaf-50" : "border-neutral-300 hover:border-neutral-400"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf-600 has-[:focus-visible]:ring-offset-1`}>
                <input type="radio" name={name} value={o.value} checked={on} onChange={() => set(name, o.value)} className="h-4 w-4 accent-leaf-700" />
                <span><span className="text-[15px] text-forest-900">{o.label}</span>{o.hint && <span className="block text-xs text-ink-muted">{o.hint}</span>}</span>
              </label>
            );
          })}
        </div>
      </Shell>
    </fieldset>
  );
}

/** Multi-select as a checkbox group (works everywhere, incl. screen readers and small phones). */
export function CheckboxGroupField({ name, label, hint, required, options }:
  Base & { options: ReadonlyArray<string | { value: string; label: string }> }) {
  const { values, errors, set } = useForm();
  const current: string[] = Array.isArray(values[name]) ? values[name] : [];
  const toggle = (v: string) => set(name, current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  return (
    <fieldset aria-describedby={describe(name, hint, errors[name])}>
      <Shell {...{ name, label, hint, required, legend: true }}>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; const on = current.includes(v);
            return (
              <label key={v} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2 text-[15px] transition-colors ${on ? "border-leaf-600 bg-leaf-50" : "border-neutral-300 hover:border-neutral-400"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf-600 has-[:focus-visible]:ring-offset-1`}>
                <input type="checkbox" checked={on} onChange={() => toggle(v)} className="h-4 w-4 accent-leaf-700" />
                <span className="text-forest-900">{l}</span>
              </label>
            );
          })}
        </div>
      </Shell>
    </fieldset>
  );
}

export function CheckboxField({ name, children }: { name: string; children: ReactNode }) {
  const { values, errors, set } = useForm();
  const err = errors[name];
  return (
    <div className="space-y-1.5" data-field={name}>
      <label className={`flex cursor-pointer gap-3 rounded-md border p-4 ${err ? "border-danger-fg/60 bg-danger-bg/40" : "border-neutral-300"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf-600`}>
        <input id={ids(name).id} type="checkbox" checked={values[name] === true} onChange={(e) => set(name, e.target.checked)}
          aria-invalid={!!err} aria-describedby={err ? ids(name).errId : undefined} className="mt-1 h-5 w-5 shrink-0 accent-leaf-700" />
        <span className="text-[15px] leading-relaxed text-forest-900">{children}</span>
      </label>
      {err && <p id={ids(name).errId} role="alert" className="text-sm font-medium text-danger-fg">! {err}</p>}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
export const Row = ({ children }: { children: ReactNode }) => <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
