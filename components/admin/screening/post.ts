/** POST to the screening API and turn any failure into one readable sentence (with the server's code and ref when there is one). */
export async function postScreening<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch("/api/admin/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: d as T };
    const extra = d.code ? ` (code ${d.code}${d.ref ? `, ref ${d.ref}` : ""})` : "";
    const timeout = d.code === "NETWORK" ? " Google Sheets did not answer in time; wait a minute and try again." : "";
    return { ok: false, error: `${d.message ?? `The server answered ${res.status}.`}${timeout}${extra}`, data: d };
  } catch { return { ok: false, error: "Could not reach the server. Check your connection and try again." }; }
}
