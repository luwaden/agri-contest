/** Content and option lists for the Call for Mentors page. Only facts from the concept note are stated as fact. */
export const MENTOR_AREAS = [
  { value: "FINANCE", label: "Access to finance and investor readiness" },
  { value: "BUSINESS_PLAN", label: "Business planning and strategy" },
  { value: "FIN_MGMT", label: "Financial management and record keeping" },
  { value: "MARKETING", label: "Marketing, sales and branding" },
  { value: "MARKET_ACCESS", label: "Market access and off-take" },
  { value: "OPERATIONS", label: "Operations and supply chain" },
  { value: "PRODUCTION", label: "Crop production and agronomy" },
  { value: "TECHNOLOGY", label: "Technology and innovation" },
  { value: "LEGAL", label: "Legal, compliance and formalisation" },
  { value: "LEADERSHIP", label: "Leadership and team building" },
] as const;

export const MENTOR_AVAILABILITY = [
  { value: "LT_2", label: "Less than 2 hours a month" },
  { value: "2_5", label: "2 to 5 hours a month" },
  { value: "5_10", label: "5 to 10 hours a month" },
  { value: "GT_10", label: "More than 10 hours a month" },
  { value: "DISCUSS", label: "To be discussed" },
] as const;

export const MENTOR_STATUSES = [
  { value: "NEW", label: "New" }, { value: "UNDER_REVIEW", label: "Under review" },
  { value: "ACCEPTED", label: "Accepted" }, { value: "DECLINED", label: "Declined" },
] as const;

export const MENTOR_PAGE = {
  why: "Winning ideas need more than capital. The programme gives its ten winners structured mentorship, business development support and investor matchmaking, and every shortlisted venture benefits from experienced eyes on its plan.",
  who: [
    "Professionals with experience in agribusiness, finance, enterprise support, technology or related fields",
    "Business owners and founders who have built or scaled a venture",
    "Experts in business development services, investor relations or market access",
  ],
  expectations: [
    "Share practical advice and honest feedback",
    "Help young entrepreneurs sharpen their business plans and pitches",
    "Open doors to your networks where appropriate",
    "Treat what founders share with you as confidential",
  ],
  // Deliberately generic: the programme team has not published a fixed mentor time commitment.
  commitment: "Time commitment is agreed with each mentor. Tell us how much time you could offer in the form and the programme team will match it to what is needed.",
  process: [
    ["Apply", "Complete the short form below."],
    ["Review", "The programme team reviews every mentor application."],
    ["Match", "Accepted mentors are matched with ventures that fit their expertise."],
    ["Mentor", "You and your mentee agree how and when to work together."],
  ],
} as const;
