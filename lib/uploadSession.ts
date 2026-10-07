/** A random id per browser that names the applicant's Cloudinary folder before an application reference exists. Client-only. */
const KEY = "agri-contest.upload-session";
export function getUploadSession(): string {
  try {
    let s = localStorage.getItem(KEY);
    if (!s || !/^[A-Za-z0-9_-]{12,40}$/.test(s)) {
      const bytes = crypto.getRandomValues(new Uint8Array(15));
      s = Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      localStorage.setItem(KEY, s);
    }
    return s;
  } catch { return Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join(""); }
}
export const clearUploadSession = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
