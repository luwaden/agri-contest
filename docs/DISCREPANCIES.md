# Concept note vs. implementation brief

The brief says to follow the brief for the web app and to flag differences. Nothing below was silently changed.

| # | Topic | Concept note | Brief / what was built | Action needed |
|---|---|---|---|---|
| 1 | **Application dates** | Public launch Mon **12 Oct**; open call closes Sun **15 Nov 2026** (5 weeks). Platform "live" by 11 Oct. | Opens **2 Oct**, closes **16 Oct 2026** (2 weeks). Built as specified, via `APPLICATION_OPEN_DATE` / `APPLICATION_CLOSE_DATE`. Inclusive to 23:59:59 WAT on 16 Oct. | Confirm with the Project Committee. The note also says training cohorts run 12 Oct–8 Nov, and a 2-week call may not deliver the 200+ submissions target. |
| 2 | **Partners** | Names AGRA (funder), SMEDAN (implementing partner), Jesnoch International (technical adviser), **Plus Incubation Hub (delivery consultant)**. | Brief lists AGRA, PIATA, SMEDAN, JESNOCH, EDC, KBS. Built the brief's six as placeholders. | PIATA, EDC, KBS do not appear in the note (roles unknown, shown generically as "Partner"). Plus Incubation Hub is in the note but not in the brief's visibility list: it is credited in the footer/partners text; add it to `PARTNERS` if wanted. |
| 3 | **Top 100 vs 120 showcased** | Objective: showcase **120** innovations, narrowed to 10; process: Top 100 → Top 30 → 10. | Landing copy says "Top 100 / Top 30 / 10 winners" and does not state 120. | Note is internally inconsistent about how 120 relates to Top 100. Clarify before publishing either number. |
| 4 | **60/40 geography** | 60% of participation from Kaduna, Niger, Nasarawa; 40% others; winners ≥60% focal. | Dashboard shows a "Focal-state participation" target of 60% (in addition to the brief's 30% female, 20% rural). | Confirm 60% applies to applicants (not only winners). |
| 5 | **Eligibility** | Nigerian youth **18–35**. | Enforced server-side (configurable in `PROGRAMME.eligibility`), and age is calculated from date of birth instead of typed. | none |
| 6 | **Business required?** | "operating or founding" ventures. | Idea-stage allowed; CAC registration optional. | none |
| 7 | **Rural definition** | "Rural youth participation ≥20%", not defined. | `rural` = lives **or** operates the business in a rural area. | Confirm the official definition; it is one line in `lib/mapper.ts`. |
| 8 | **Data tooling** | MEL via KoboToolbox/ODK + Power BI. | Sheets is the store; the metric tabs are Power BI-connectable. | Decide whether Kobo remains a parallel capture channel. |
| 9 | **Language** | Training in English and Hausa. | Application form is English only. | Hausa form is a possible later addition. |
| 10 | **Prize/contract values** | ₦40m programme value. | Deliberately **not** shown publicly (contract value, not prize value). | Supply official prize amounts if they should be advertised. |
