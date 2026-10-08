/**
 * Prints the column titles (row 1) of every tab, so they can be typed or pasted by hand if setup:sheets cannot be used.
 * npm run print:headers            → every tab
 * npm run print:headers -- Mentors → one tab (tab-separated: paste into cell A1)
 */
import { HEADERS } from "../lib/google-sheets/schema";
const only = process.argv.slice(2).join(" ").trim();
for (const [tab, headers] of Object.entries(HEADERS)) {
  if (only && tab.toLowerCase() !== only.toLowerCase()) continue;
  console.log(only ? headers.join("\t") : `\n${tab} (${headers.length} columns):\n${headers.join("\t")}`);
}
