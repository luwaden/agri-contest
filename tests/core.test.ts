import test from "node:test";
import assert from "node:assert/strict";
import { validateAll, validateStage } from "../lib/validation/application";
import { computeAnalytics } from "../lib/analytics/compute";
import { filterApplications } from "../lib/analytics/filters";
import { locationGroupFor } from "../lib/location";
import { toApplication } from "../lib/mapper";
import { applicationToRow, rowToApplication, APPLICATION_COLUMNS } from "../lib/google-sheets/schema";
import { averageScore } from "../types/scoring";
import { generateReference, REFERENCE_PATTERN } from "../lib/reference";
import { calculateAge } from "../lib/dates";
import { windowSummary } from "../lib/window";
import { sample } from "./fixtures";

const app = (o: Record<string, unknown> = {}, id = "AGRA-2026-AAAAAA") =>
  toApplication(validateAll({ ...sample, declaration: true, ...o }).data, { applicationId: id, status: "SUBMITTED", now: new Date("2026-10-05T10:00:00Z") });

test("sample form validates fully", () => {
  const r = validateAll({ ...sample, declaration: true });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("friendly errors, no technical messages", () => {
  const r = validateStage(1, { ...sample, businessName: "" });
  assert.equal(r.ok, false);
  assert.equal((r as any).errors.businessName, "Please enter your business name.");
});

test("age eligibility 18-35 enforced", () => {
  assert.equal(validateStage(0, { ...sample, dateOfBirth: "2012-01-01" }).ok, false);
  assert.equal(validateStage(0, { ...sample, dateOfBirth: "1970-01-01" }).ok, false);
  assert.equal(calculateAge("2000-02-30"), null);
});

test("phone, email, url, numbers", () => {
  assert.equal(validateStage(0, { ...sample, phone: "12345" }).ok, false);
  assert.equal(validateStage(0, { ...sample, email: "nope" }).ok, false);
  assert.equal(validateStage(1, { ...sample, website: "javascript:alert(1)" }).ok, false);
  assert.equal(validateStage(1, { ...sample, jobsCreated: "-3" }).ok, false);
  assert.equal(validateStage(1, { ...sample, youthEmployed: "99" }).ok, false);
});

test("conditional rules", () => {
  assert.equal(validateStage(0, { ...sample, disability: "YES", disabilityType: "" }).ok, false);
  assert.equal(validateStage(1, { ...sample, registrationStatus: "CAC_REGISTERED", registrationNumber: "" }).ok, false);
  assert.equal(validateAll({ ...sample, declaration: false }).ok, false);
});

test("location group derived from state", () => {
  for (const s of ["Kaduna", "Niger", "Nasarawa"]) assert.equal(locationGroupFor(s), "FOCAL_STATES");
  assert.equal(locationGroupFor("Lagos"), "OTHER_STATES");
  assert.equal(app({ state: "Kano" }).location.locationGroup, "OTHER_STATES");
});

test("analytics: focal counts calculated, never trust stored group", () => {
  const a = app({ state: "Kaduna", gender: "FEMALE" }, "AGRA-2026-AAAAA2");
  const b = app({ state: "Lagos", gender: "MALE", residenceSetting: "URBAN", businessSetting: "URBAN" }, "AGRA-2026-AAAAA3");
  b.location.locationGroup = "FOCAL_STATES"; // corrupt stored value on purpose
  const r = computeAnalytics([a, b]);
  assert.equal(r.total, 2); assert.equal(r.focal.kadunaCount, 1); assert.equal(r.focal.focalStateCount, 1);
  assert.equal(r.focal.otherStateCount, 1); assert.equal(r.focal.focalStatePercentage, 50);
  assert.equal(r.demographics.female, 1);
  const female = r.targets.find((t) => t.id === "female")!;
  assert.equal(female.current, 50); assert.equal(female.met, true); assert.equal(female.gap, 0);
});

test("analytics: zero data yields nulls not fake numbers", () => {
  const r = computeAnalytics([]);
  assert.equal(r.total, 0); assert.equal(r.focal.focalStatePercentage, null); assert.equal(r.targets[0].current, null);
});

test("filters", () => {
  const list = [app({ state: "Kaduna" }, "AGRA-2026-AAAAA2"), app({ state: "Lagos" }, "AGRA-2026-AAAAA3")];
  assert.equal(filterApplications(list, { locationGroup: "FOCAL_STATES" }).length, 1);
  assert.equal(filterApplications(list, { state: "Lagos" }).length, 1);
  assert.equal(filterApplications(list, { q: "aaaaa3" }).length, 1);
});

test("sheet row round-trips and neutralises formula injection", () => {
  const a = app({ description: "=HYPERLINK(\"http://evil\")  maize aggregation for smallholders", languages: ["English", "Other"], languagesOther: "Fula; Bura" });
  const row = applicationToRow(a);
  assert.equal(row.length, APPLICATION_COLUMNS.length);
  assert.ok(row[APPLICATION_COLUMNS.findIndex((c) => c.header === "business_description")].startsWith("'="));
  const back = rowToApplication(row);
  assert.equal(back.business.description, a.business.description);
  assert.equal(back.impact.jobsCreated, a.impact.jobsCreated);
  assert.equal(back.inclusion.rural, a.inclusion.rural);
  assert.equal(back.location.state, a.location.state);
  assert.equal(back.business.employees.women, a.business.employees.women);
});

test("average score ignores missing judges (never zero)", () => {
  assert.equal(averageScore([80, 60, null, undefined]), 70);
  assert.equal(averageScore([]), null);
});

test("reference numbers are non-sequential and well-formed", () => {
  const s = new Set(Array.from({ length: 500 }, () => generateReference()));
  assert.equal(s.size, 500);
  for (const r of s) assert.match(r, REFERENCE_PATTERN);
});

test("window status driven by dates", () => {
  assert.equal(windowSummary(new Date("2026-09-29T09:00:00Z")).status, "OPENING_SOON");
  assert.equal(windowSummary(new Date("2026-10-08T00:00:01+01:00")).status, "OPEN");
  assert.equal(windowSummary(new Date("2026-10-16T23:59:00+01:00")).status, "OPEN");
  assert.equal(windowSummary(new Date("2026-10-17T00:00:01+01:00")).status, "CLOSED");
});
