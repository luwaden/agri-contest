/** Prints the Applications header row (tab-separated) so it can be pasted into cell A1 of the sheet if `npm run setup:sheets` is not used. */
import { HEADERS, SHEETS } from "../lib/google-sheets/schema";
console.log(HEADERS[SHEETS.applications].join("\t"));
