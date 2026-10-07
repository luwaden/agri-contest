"use client";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:border-leaf-600 no-print">Print</button>;
}
