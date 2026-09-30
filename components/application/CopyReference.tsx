"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {} }}>Copy reference</Button>
      <span role="status" className="text-sm text-leaf-800">{copied ? "Copied" : ""}</span>
    </div>
  );
}
