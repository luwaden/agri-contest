/** Age in whole years on `on` (default now), or null if the date is invalid/future. */
export function calculateAge(dob: string, on: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  let age = on.getUTCFullYear() - y;
  const before = on.getUTCMonth() < mo - 1 || (on.getUTCMonth() === mo - 1 && on.getUTCDate() < d);
  if (before) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}
