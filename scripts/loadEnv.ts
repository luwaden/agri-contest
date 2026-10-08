/** Loads .env / .env.local exactly the way Next.js does (handles quotes and multi-line values). Import this FIRST. */
import * as nextEnv from "@next/env";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const load = (nextEnv as any).loadEnvConfig ?? (nextEnv as any).default?.loadEnvConfig;
if (typeof load !== "function") throw new Error("Could not load @next/env. Run npm install and try again.");
load(process.cwd());

export const ENV_FOLDER = process.cwd();
export const envFilesFound = [".env", ".env.local"].filter((f) => existsSync(path.join(ENV_FOLDER, f)));
/** Windows hides file extensions, so Notepad often saves ".env" as ".env.txt". */
export const misnamedEnvFiles = readdirSync(ENV_FOLDER).filter((f) => /^\.?env(\..*)?\.txt$/i.test(f) || /^env$/i.test(f));

export function envHint(): string {
  if (envFilesFound.length) return `Settings file found: ${envFilesFound.join(", ")}. It is missing these values, or they are spelled differently.`;
  const lines = [`There is no .env or .env.local file in this folder:\n    ${ENV_FOLDER}`];
  if (misnamedEnvFiles.length) lines.push(`Found "${misnamedEnvFiles[0]}", which has the wrong name. Rename it to exactly .env`);
  else lines.push("The zip never includes your secrets. Copy your .env from your old project folder into THIS folder (next to package.json), or create a new one.");
  return lines.join("\n  ");
}
