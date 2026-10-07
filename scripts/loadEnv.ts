/** Loads .env / .env.local exactly the way Next.js does (handles quotes and multi-line values). Import this FIRST. */
import * as nextEnv from "@next/env";
const load = (nextEnv as any).loadEnvConfig ?? (nextEnv as any).default?.loadEnvConfig;
if (typeof load !== "function") throw new Error("Could not load @next/env. Run npm install and try again.");
load(process.cwd());
