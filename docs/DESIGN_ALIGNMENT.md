# Does the Contest Design Framework (v1.0, with Jesnoch's 16 review comments) align with the app?

**Short answer:** the **judging side** now aligns well (rubric, tie-breaks, conflict-of-interest, no staff scoring, reviewers/judges). The **applicant side does not yet**: the framework describes a *light Stage 1 → full Stage 2 funnel with five innovation categories*, while the app collects *one long form up front with no categories*. And the framework itself contradicts itself in five places (Jesnoch's comment 0), so some things should **wait for v2.0** rather than be built now.

Legend: ✔ aligned · ◐ partly · ✘ gap · ⚠ the framework is itself inconsistent (decide first)

## 1. What the framework says vs. what the app does

| # | Framework | App today | |
|---|---|---|---|
| 1 | **Rubric:** Originality 30, Feasibility 25, Scalability 25, Social & environmental impact 10, Market potential 10; score 1–10, weighted to /100 | **Fixed this release.** Was 7 equal draft criteria; now exactly 30/25/25/10/10 with a tested weighted-total function (missing score is never counted as zero) | ✔ |
| 2 | **Score bands** (Exceptional 9–10 … Insufficient 1–2) | In the judges'/reviewers' portal and in the assistant | ✔ |
| 3 | **Tie-breaks:** originality → scalability → feasibility → moderation panel | Implemented and tested (`lib/scoring.ts`); moderation step needs a role (see 9) | ◐ |
| 4 | **Conflict-of-interest declaration** before scoring; entries with a relationship are reassigned | Judges/reviewers must tick the declaration when applying (**new**). Automatic per-entry reassignment is not built | ◐ |
| 5 | **"Our staff do not score entries"** | Administrators and Coordinators have no scoring permission; only Judges and Reviewers can score (tested) | ✔ |
| 6 | **Reviewer pool (~10) scores in Tier 2; judges in later tiers** | Reviewer role **added** (login, portal, permissions). Assignment and the scoring form are the next release | ◐ |
| 7 | **No payment** to enter, progress or receive an award | Stated by the assistant; not yet on the public FAQ | ◐ |
| 8 | **Prize figure not published** ("seed funding" without a number) | Site never states an amount | ✔ |
| 9 | **Moderation panel** (ties, discrepancies) | No Moderator role yet | ✘ |
| 10 | **Audit trail** of scores, comments, reassignments | Audit-event log exists (submissions, status changes, exports, AI queries, file views); score events arrive with scoring | ◐ |
| 11 | **Data handover:** full dataset to the Project; data ownership | CSV export for admins/coordinators (logged). Certified deletion on request is a manual process | ◐ |
| 12 | **Data protection:** consent at entry, NDPA 2023, encrypted | Consent declaration ✔. The privacy notice does **not** name the NDPA 2023 yet ✘. Encryption at rest/in transit relies on Google, Vercel and Upstash | ◐ |
| 13 | **Visibility:** AGRA · PIATA · SMEDAN · JESNOCH · EDC · KBS prominent (Clause 16) | Header strip has AGRA, SMEDAN, KBS, Jesnoch, EDC (the order you specified). **PIATA is missing** (no logo supplied) | ◐ |
| 14 | **Language:** English platform | English | ✔ |
| 15 | **Mobile-first, low-spec Android, 2G/3G** | Mobile-first and lightweight; not tested on throttled 2G/3G | ◐ |
| 16 | **Accessibility:** screen reader, keyboard, **high-contrast mode**, assisted entry by phone | Screen-reader/keyboard ✔. No high-contrast toggle, no phone-assisted entry ✘ | ◐ |
| 17 | **Stage 1 = light:** bio, four 200–350-word answers, business name + registration number, **no uploads** ("the purpose is to see the idea") | One long form with ~55 questions (revenue, employees, reach figures) and document uploads, then submit. It collects **more** than Stage 1 should | ✘ |
| 18 | **Stage 2 at Top 100:** full proposal + documents after an onboarding call | Does not exist: everything is asked at once | ✘ |
| 19 | **Five innovation categories**, applicant chooses one; report by category for balance at Top 30 | **No category field.** Only value chain (maize/rice/soybean/allied). Category balance cannot be reported | ✘ |
| 20 | **Eligibility:** citizen/legal resident, 18–35 **on the closing date**, located in Nigeria, original entry owned/authorised, consent; employees/family of PiH, SMEDAN, Jesnoch, AGRA ineligible | Age is checked **at submission** (not the closing date); nationality is free text and not checked; "original work / authorised" and "not staff or family" are not asked | ◐ |
| 21 | **Tier 1 automated screen** (age, nationality, registration, crop link, completeness, de-dup) with a recorded reason | Only age and duplicate email. No screening records, no notifications | ✘ |
| 22 | **Written feedback to all 100** by 26 Oct | Not built (needs scores + comments + notification) | ✘ |
| 23 | **Appeals** (eligibility errors; procedural irregularity) | Not built | ✘ |
| 24 | **Registration interlink:** applicants register once on the project platform and pass straight to the application | Applicants have no accounts; no link to a registration system | ✘ |
| 25 | **Dates:** open call **Mon 5 – Mon 12 Oct 23:59 WAT**; training day 16 Oct; physical training Niger 19 / Nasarawa 21 / Kaduna 23 Oct; **finale Wed 28 Oct**; MSMEs conference 7–9 Nov | App window **2–16 Oct** (your instruction). Site said finale **10 Dec** (concept note). Now one setting, `FINALE_DATE_LABEL` | ⚠ |
| 26 | **Contest name:** "Annual Youth in Agribusiness Innovation Contest"; strapline "Your idea. Your farm. Your future." | "AGRA–SMEDAN Youth Agri-Innovation Contest" (your instruction). Strapline not used | ⚠ |
| 27 | Training: Virtual Training Day for all verified entrants; physical days in three states | Site claims "100+ youths trained" and an "eight-module certified" programme (concept note). **The framework mentions neither.** Verify these public claims | ⚠ |

## 2. Where the framework contradicts itself (so the app should not hard-code it yet)
These come from Jesnoch's comments. **Do not build these until v2.0 is issued** (the document says changes after launch are allowed only to correct errors):

| Issue | Why the app waits |
|---|---|
| **Business registration** "not required" (§4) vs. required (inception decision, E9) | The form treats it as optional, which matches §4. If it becomes required, it is a one-line validation change. It also clashes with "an idea at concept stage is eligible" (the *two-track* question: early-stage vs operating) |
| **60/40 geographic weighting** applied at Tier 1 *and* Tier 3 | Reviewer says: eligibility pass/fail at Tier 1, weighting only at Tier 3. The app applies **no** quota at Tier 1 (good). Admin analytics already separates Kaduna/Niger/Nasarawa from other states to support Tier 3. **Not shown publicly** |
| **7 judges incl. a PiH nominee** vs. **9 judges** (Inception Report) | Panel rules are not hard-coded; the public pages state no number |
| **Same full rubric at every stage** | Reviewer proposes stage-specific guidance (Stage 1: what can be seen; Stage 2: evidence incl. team/traction; pitch: presentation & Q&A). The app has one rubric today; stage-specific *descriptors* can be added without changing weights |
| **Appeals timing** (48+48+48h does not fit the schedule) and PiH deciding appeals on its own screening | Appeals are not built; the workflow should follow the corrected v2.0 |
| **Crop-connection test** cannot be judged automatically from text | When Tier 1 is built it should **flag for human review**, never auto-disqualify |
| **Moderation panel PiH-chaired** | Moderator/PIU roles should follow the final constitution |

## 3. What I changed in this release because it was clear-cut
- Rubric → exactly the framework's five weighted criteria, with bands and the tie-break rule, plus tested scoring functions.
- Reviewer role (with the judge's "assigned applications only" limit); programme staff cannot score.
- Mentors/Judges/Reviewers application: roles chosen, conflict-of-interest declaration for judges and reviewers.
- Assistant knowledge: rubric, bands, conflict-of-interest rule, tie-breaks, "no payment" (all from the framework).
- Finale date → one setting (`FINALE_DATE_LABEL`).

## 4. Decisions I need from you (in this order)
1. **Which dates are real?** Framework (5–12 Oct, finale 28 Oct) vs. your window (2–16 Oct) vs. concept note (finale 10 Dec). Set `APPLICATION_OPEN_DATE`, `APPLICATION_CLOSE_DATE`, `FINALE_DATE_LABEL`.
2. **Two-stage form?** Shorten today's form to the framework's Stage 1 (bio, four 200–350-word answers, business name/registration, category) and collect the rest from the Top 100. Biggest alignment win, and it helps rural/first-time applicants. *Risky mid-call: it changes the form people are filling in.*
3. **Add the five categories** to the form and the admin filters (required to report balance at Top 30).
4. **Registration required or not** (and the two-track rule) once v2.0 decides.
5. **Add PIATA** (needs the logo) and confirm the training claims on the site.
6. Then build: scoring + assignment (with conflict-of-interest reassignment), Tier 1 flags, moderation role, appeals, written-feedback export.
