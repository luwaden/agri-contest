import { APPLICATION_COLUMNS, applicationToRow, rowToApplication } from "@/lib/google-sheets/schema";
import { validateAll } from "@/lib/validation/application";
import { toApplication } from "@/lib/mapper";
import { SAMPLE_VALUES } from "@/lib/demo-values";

/** The exact path a submission takes, minus the final append: validate → build the record → turn it into a sheet row → read it back. */
export function mappingRoundTrip(): { ok: boolean; detail: string } {
  const v = validateAll({ ...SAMPLE_VALUES, declaration: true });
  if (!v.ok) return { ok: false, detail: "The built-in sample application no longer passes validation." };
  const app = toApplication(v.data, { applicationId: "AGRA-2026-SELFT2", status: "SUBMITTED", now: new Date() });
  const row = applicationToRow(app);
  if (row.length !== APPLICATION_COLUMNS.length) return { ok: false, detail: `Row has ${row.length} cells but the sheet expects ${APPLICATION_COLUMNS.length}.` };
  const back = rowToApplication(row);
  const same = back.applicant.email === app.applicant.email && back.location.state === app.location.state && back.business.businessName === app.business.businessName && back.impact.jobsCreated === app.impact.jobsCreated && back.languages.join() === app.languages.join();
  return same ? { ok: true, detail: `A complete application converts to ${row.length} cells and back without losing anything.` } : { ok: false, detail: "Data changed during the round trip." };
}

