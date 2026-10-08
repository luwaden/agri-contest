/**
 * Content and options for the "Mentors, Judges & Reviewers" call. Facts come from the Contest Design Framework
 * and the concept note. Where a fact is still contested (panel size, reviewer pool size, time commitment) the page
 * says so plainly instead of stating a number.
 */
export const PANEL_ROLES = [
  { value: "MENTOR", label: "Mentor", hint: "Guide a winning venture for six months" },
  { value: "JUDGE", label: "Judge", hint: "Score entries and join the finale panel" },
  { value: "REVIEWER", label: "Reviewer", hint: "Score entries in the screening rounds" },
] as const;

/** Areas of expertise. Mirrors the spread the framework asks the panel to cover. */
export const PANEL_EXPERTISE = [
  { value: "AGRIBUSINESS", label: "Agribusiness and value chains" },
  { value: "AGRI_FINANCE", label: "Agricultural finance and investment" },
  { value: "TECHNOLOGY", label: "Technology and digital farming" },
  { value: "MARKET_SYSTEMS", label: "Market systems and supply chains" },
  { value: "YOUTH_ENTERPRISE", label: "Youth enterprise and business development" },
  { value: "CLIMATE", label: "Climate-smart agriculture" },
  { value: "PROCESSING", label: "Agro-processing and value addition" },
  { value: "INCLUSION", label: "Gender inclusion and social impact" },
] as const;

export const PANEL_AVAILABILITY = [
  { value: "LT_2", label: "Under 2 hours a month" },
  { value: "2_5", label: "2 to 5 hours a month" },
  { value: "5_10", label: "5 to 10 hours a month" },
  { value: "GT_10", label: "More than 10 hours a month" },
  { value: "DISCUSS", label: "To be discussed" },
] as const;

/** Kept for older records and tools that still import the previous names. */
export const MENTOR_AREAS = [...PANEL_EXPERTISE, { value: "FINANCE", label: "Access to finance and investor readiness" }, { value: "BUSINESS_PLAN", label: "Business planning and strategy" }, { value: "FIN_MGMT", label: "Financial management" }, { value: "MARKETING", label: "Marketing, sales and branding" }, { value: "MARKET_ACCESS", label: "Market access" }, { value: "OPERATIONS", label: "Operations and supply chain" }, { value: "PRODUCTION", label: "Crop production" }, { value: "LEGAL", label: "Legal and compliance" }, { value: "LEADERSHIP", label: "Leadership" }] as const;
export const MENTOR_AVAILABILITY = PANEL_AVAILABILITY;

export const MENTOR_STATUSES = [
  { value: "NEW", label: "New" }, { value: "UNDER_REVIEW", label: "Under review" },
  { value: "ACCEPTED", label: "Accepted" }, { value: "DECLINED", label: "Declined" },
] as const;

export const PANEL_PAGE = {
  intro: "The contest only works if experienced people give their time. We are building a panel of mentors, judges and reviewers from across agribusiness, finance, technology and enterprise support. Tell us how you would like to help.",
  roles: [
    { role: "Mentor", tone: "green", what: "Guides a winning venture through the six months after the contest: advice, introductions and honest feedback.", when: "After the finale" },
    { role: "Judge", tone: "blue", what: "Scores entries against the published rubric and listens to the finalists' live pitches. Judges are independent experts. Programme staff do not score.", when: "Later rounds and the finale" },
    { role: "Reviewer", tone: "yellow", what: "Scores entries against the same rubric in the screening rounds, helping the strongest ideas reach the next stage.", when: "Screening rounds" },
  ],
  rules: [
    "Judges and reviewers declare any personal, commercial, advisory or investment relationship with an applicant, and never score that entry.",
    "Everyone scores against the same published rubric, and every score and comment is recorded for audit.",
    "What founders share with you is confidential.",
  ],
  // The framework gives no fixed hours, and the panel size is still being settled, so none is stated.
  commitment: "Time depends on the role and is agreed with you. Tell us how many hours a month you could offer.",
  process: [["Apply", "Answer a few short questions."], ["Review", "The programme team reviews every application."], ["Confirm", "If accepted you are told your role and given a login if you will score."], ["Serve", "You are briefed before you start."]],
} as const;
export const MENTOR_PAGE = { why: PANEL_PAGE.intro, who: [], expectations: PANEL_PAGE.rules, commitment: PANEL_PAGE.commitment, process: PANEL_PAGE.process } as const;
