import "server-only";
import type { ApplicationRepository } from "./types";
import { LocalRepository } from "./local";
import { SheetsRepository } from "@/lib/google-sheets/applications";
import { sheetsConfigured } from "@/lib/google-sheets/client";

let repo: ApplicationRepository | null = null;

/** DATA_BACKEND=sheets | local. Production must use sheets (or a future SQL backend). */
export function getRepository(): ApplicationRepository {
  if (repo) return repo;
  const choice = process.env.DATA_BACKEND || (sheetsConfigured() ? "sheets" : "local");
  if (choice === "sheets") repo = new SheetsRepository();
  else {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_BACKEND=local is not allowed in production. Configure Google Sheets.");
    repo = new LocalRepository();
  }
  return repo;
}
