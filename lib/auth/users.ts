import "server-only";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/types/user";

interface StoredUser { id?: string; email: string; name: string; role: SessionUser["role"]; passwordHash: string }

/**
 * Staff accounts come from the ADMIN_USERS_JSON env var (bcrypt hashes only, never plaintext, never in the sheet).
 * Replace this function with a database lookup when moving off env-based accounts.
 */
function loadUsers(): StoredUser[] {
  const raw = process.env.ADMIN_USERS_JSON;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as StoredUser[];
    return list.filter((u) => u.email && u.passwordHash && ["ADMIN", "COORDINATOR", "JUDGE"].includes(u.role));
  } catch { console.error("ADMIN_USERS_JSON is not valid JSON."); return []; }
}

// Constant-time-ish behaviour for unknown emails
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4zFq3qIuF6Jd5o7oB7R0nY1Zb6F2";

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = loadUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id ?? user.email, name: user.name, email: user.email.toLowerCase(), role: user.role };
}
