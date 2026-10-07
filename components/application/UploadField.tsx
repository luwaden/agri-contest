"use client";
import { useContext, useRef, useState } from "react";
import { FormCtx, TextField } from "./fields";
import { ACCEPT_ATTR } from "@/lib/cloudinary/validate";
import { getUploadSession } from "@/lib/uploadSession";

type State = { kind: "idle" } | { kind: "uploading"; name: string } | { kind: "done"; name: string } | { kind: "error"; message: string };

/** A link field that can also be filled by uploading a file. The stored value is still an https URL, so existing validation is unchanged. */
export function UploadField({ name, label, kind, scope = "applicant", owner, hint }: { name: string; label: string; kind: string; scope?: "applicant" | "mentor"; owner?: string; hint?: string }) {
  const { set } = useContext(FormCtx);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onPick(file: File) {
    setState({ kind: "uploading", name: file.name });
    try {
      const body = new FormData();
      body.set("file", file); body.set("scope", scope); body.set("kind", kind); body.set("owner", owner ?? getUploadSession());
      const r = await fetch("/api/uploads", { method: "POST", body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "The upload did not go through. Please try again.");
      set(name, d.url); setState({ kind: "done", name: file.name });
    } catch (e) { setState({ kind: "error", message: (e as Error).message }); }
    finally { if (input.current) input.current.value = ""; }
  }

  return (
    <div className="space-y-2">
      <TextField name={name} label={label} type="url" inputMode="url" placeholder="https://… or upload a file below" hint={hint} />
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" id={`file-${name}`} aria-describedby={`file-${name}-status`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }} />
        <label htmlFor={`file-${name}`} className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border-2 border-primary px-5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${state.kind === "uploading" ? "pointer-events-none opacity-60" : ""}`}>
          {state.kind === "uploading" ? "Uploading…" : "Upload a file"}
        </label>
        <span className="text-xs text-ink-muted">PDF, image, Word or PowerPoint · up to 8 MB</span>
      </div>
      <p id={`file-${name}-status`} role="status" aria-live="polite" className={`text-sm font-medium ${state.kind === "error" ? "text-danger-fg" : "text-primary"}`}>
        {state.kind === "uploading" && `Uploading ${state.name}…`}{state.kind === "done" && `Uploaded: ${state.name}. The link has been added above.`}{state.kind === "error" && state.message}
      </p>
    </div>
  );
}
