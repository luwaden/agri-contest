import "server-only";
import type { ApplicationRepository } from "./types";
import { LocalRepository } from "./local";
import { SheetsRepository } from "@/lib/google-sheets/applications";
import { sheetsConfigured } from "@/lib/google-sheets/client";
import { AppsScriptTransport, appsScriptConfigured } from "@/lib/google-sheets/appsScript";

let repo: ApplicationRepository | null = null;

/** DATA_BACKEND=sheets (service account) | appsscript (script inside the sheet) | local (development only). */
export function getRepository(): ApplicationRepository {
  if (repo) return repo;
  const choice = process.env.DATA_BACKEND || (sheetsConfigured() ? "sheets" : appsScriptConfigured() ? "appsscript" : "local");
  if (choice === "sheets") repo = new SheetsRepository();
  else if (choice === "appsscript") repo = new SheetsRepository(new AppsScriptTransport());
  else {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_BACKEND=local is not allowed in production. Set DATA_BACKEND=sheets or appsscript.");
    repo = new LocalRepository();
  }
  return repo;
}
