// Comprehensive touchpoints seed data
// Run once to populate the touchpoints table

export const TOUCHPOINTS_SEED = [
  // ─── US Federal Holidays ──────────────────────────────────────────────────
  { name: "New Year's Day", category: "federal_holiday" as const, monthDay: "01-01", description: "Happy New Year! A fresh start for everyone." },
  { name: "Martin Luther King Jr. Day", category: "federal_holiday" as const, monthDay: "01-20", description: "Honoring Dr. King's legacy of service and equality." },
  { name: "Presidents' Day", category: "federal_holiday" as const, monthDay: "02-17", description: "Honoring past US presidents." },
  { name: "Memorial Day", category: "federal_holiday" as const, monthDay: "05-26", description: "Honoring those who served." },
  { name: "Juneteenth", category: "federal_holiday" as const, monthDay: "06-19", description: "Celebrating freedom and community." },
  { name: "Independence Day", category: "federal_holiday" as const, monthDay: "07-04", description: "Happy 4th of July!" },
  { name: "Labor Day", category: "federal_holiday" as const, monthDay: "09-01", description: "Celebrating the American worker." },
  { name: "Columbus Day", category: "federal_holiday" as const, monthDay: "10-13", description: "Columbus Day holiday." },
  { name: "Veterans Day", category: "federal_holiday" as const, monthDay: "11-11", description: "Honoring all who served in the US military." },
  { name: "Thanksgiving Day", category: "federal_holiday" as const, monthDay: "11-27", description: "Giving thanks for the good things in life." },
  { name: "Christmas Day", category: "federal_holiday" as const, monthDay: "12-25", description: "Merry Christmas and happy holidays!" },

  // ─── Quirky / Fun National Days ───────────────────────────────────────────
  { name: "National Compliment Day", category: "quirky_holiday" as const, monthDay: "01-24", description: "A day to give genuine compliments." },
  { name: "National Pizza Day", category: "quirky_holiday" as const, monthDay: "02-09", description: "Celebrating everyone's favorite food." },
  { name: "Random Acts of Kindness Day", category: "quirky_holiday" as const, monthDay: "02-17", description: "A day to do something kind for no reason." },
  { name: "National Margarita Day", category: "quirky_holiday" as const, monthDay: "02-22", description: "Cheers to the weekend!" },
  { name: "National Napping Day", category: "quirky_holiday" as const, monthDay: "03-10", description: "The most relatable holiday of the year." },
  { name: "National Coffee Day", category: "quirky_holiday" as const, monthDay: "09-29", description: "For the people who run on caffeine." },
  { name: "National Taco Day", category: "quirky_holiday" as const, monthDay: "10-04", description: "Tacos deserve their own holiday." },
  { name: "National Ice Cream Day", category: "quirky_holiday" as const, monthDay: "07-20", description: "Third Sunday of July — ice cream for everyone." },
  { name: "National Donut Day", category: "quirky_holiday" as const, monthDay: "06-06", description: "First Friday of June — go grab a donut." },
  { name: "National Best Friends Day", category: "quirky_holiday" as const, monthDay: "06-08", description: "Celebrating the people who matter most." },
  { name: "National Smile Day", category: "quirky_holiday" as const, monthDay: "10-05", description: "A day to spread some joy." },
  { name: "National Gratitude Day", category: "quirky_holiday" as const, monthDay: "11-01", description: "Taking a moment to be grateful." },
  { name: "National Selfie Day", category: "quirky_holiday" as const, monthDay: "06-21", description: "Even a fun one to reference in a note." },
  { name: "National Entrepreneurs Day", category: "quirky_holiday" as const, monthDay: "11-17", description: "Third Tuesday of November — for the builders." },
  { name: "National Small Business Day", category: "quirky_holiday" as const, monthDay: "05-10", description: "Celebrating the backbone of the economy." },
  { name: "National Networking Day", category: "quirky_holiday" as const, monthDay: "02-06", description: "A great excuse to reach out." },
  { name: "National Thank You Day", category: "quirky_holiday" as const, monthDay: "01-11", description: "Simple but powerful." },
  { name: "National Friendship Day", category: "quirky_holiday" as const, monthDay: "08-03", description: "First Sunday of August." },
  { name: "World Kindness Day", category: "quirky_holiday" as const, monthDay: "11-13", description: "Be kind — it costs nothing." },
  { name: "National Positive Thinking Day", category: "quirky_holiday" as const, monthDay: "09-13", description: "Good vibes only." },
  { name: "National Lemonade Day", category: "quirky_holiday" as const, monthDay: "08-20", description: "When life gives you lemons..." },
  { name: "National Beer Day", category: "quirky_holiday" as const, monthDay: "04-07", description: "Cheers to a cold one." },
  { name: "National Barbecue Day", category: "quirky_holiday" as const, monthDay: "05-16", description: "Fire up the grill." },
  { name: "National Football Day", category: "quirky_holiday" as const, monthDay: "11-05", description: "For the football fans in your network." },
  { name: "National Golf Day", category: "quirky_holiday" as const, monthDay: "04-10", description: "Hit the links." },
  { name: "National Superhero Day", category: "quirky_holiday" as const, monthDay: "04-28", description: "For the people doing great work." },
  { name: "National Relaxation Day", category: "quirky_holiday" as const, monthDay: "08-15", description: "Take a breath. Slow down." },
  { name: "National Trivia Day", category: "quirky_holiday" as const, monthDay: "01-04", description: "Fun fact to kick off the year." },
  { name: "National Hug Day", category: "quirky_holiday" as const, monthDay: "01-21", description: "A warm touchpoint for warm people." },
  { name: "National Handshake Day", category: "quirky_holiday" as const, monthDay: "06-26", description: "For the deal-makers in your network." },
  { name: "National Mentor Day", category: "quirky_holiday" as const, monthDay: "10-27", description: "Honoring those who guide others." },

  // ─── Industry-Specific: Construction ──────────────────────────────────────
  { name: "National Construction Appreciation Week", category: "industry_specific" as const, industryTag: "construction", monthDay: "09-15", description: "Third week of September — celebrating the trades." },
  { name: "National Skilled Trades Day", category: "industry_specific" as const, industryTag: "construction", monthDay: "05-07", description: "First Wednesday of May — honoring the skilled trades." },
  { name: "World Safety Day (Construction)", category: "industry_specific" as const, industryTag: "construction", monthDay: "04-28", description: "Safety first — always relevant in construction." },
  { name: "National Roofing Week", category: "industry_specific" as const, industryTag: "construction", monthDay: "06-02", description: "First full week of June — for roofing pros." },
  { name: "National Electrician Day", category: "industry_specific" as const, industryTag: "construction", monthDay: "11-04", description: "Celebrating the people who keep the lights on." },
  { name: "National Plumber Day", category: "industry_specific" as const, industryTag: "construction", monthDay: "04-25", description: "For the plumbers in your network." },
  { name: "National Contractor Appreciation Day", category: "industry_specific" as const, industryTag: "construction", monthDay: "09-01", description: "Recognizing the work of general contractors." },

  // ─── Industry-Specific: Real Estate ───────────────────────────────────────
  { name: "National Homeownership Month", category: "industry_specific" as const, industryTag: "real_estate", monthDay: "06-01", description: "June is National Homeownership Month." },
  { name: "National Realtor Day", category: "industry_specific" as const, industryTag: "real_estate", monthDay: "05-15", description: "Celebrating real estate professionals." },
  { name: "National Open House Day", category: "industry_specific" as const, industryTag: "real_estate", monthDay: "10-01", description: "First Saturday of October — open house season." },
  { name: "Spring Real Estate Season Kickoff", category: "industry_specific" as const, industryTag: "real_estate", monthDay: "03-01", description: "Spring is the hottest time in real estate." },
  { name: "National Moving Day", category: "industry_specific" as const, industryTag: "real_estate", monthDay: "05-01", description: "May 1st is the most popular moving day of the year." },

  // ─── Industry-Specific: Healthcare ────────────────────────────────────────
  { name: "National Doctors Day", category: "industry_specific" as const, industryTag: "healthcare", monthDay: "03-30", description: "Honoring physicians everywhere." },
  { name: "National Nurses Week", category: "industry_specific" as const, industryTag: "healthcare", monthDay: "05-06", description: "May 6-12 — celebrating nurses." },
  { name: "World Health Day", category: "industry_specific" as const, industryTag: "healthcare", monthDay: "04-07", description: "A global reminder to prioritize health." },
  { name: "National Healthcare Quality Week", category: "industry_specific" as const, industryTag: "healthcare", monthDay: "10-20", description: "Third week of October." },
  { name: "National Physical Therapy Month", category: "industry_specific" as const, industryTag: "healthcare", monthDay: "10-01", description: "October is PT Month." },

  // ─── Industry-Specific: Finance / Insurance ───────────────────────────────
  { name: "National Financial Literacy Month", category: "industry_specific" as const, industryTag: "finance", monthDay: "04-01", description: "April is Financial Literacy Month." },
  { name: "National Insurance Awareness Day", category: "industry_specific" as const, industryTag: "finance", monthDay: "06-28", description: "A great touchpoint for insurance pros." },
  { name: "National Tax Day", category: "industry_specific" as const, industryTag: "finance", monthDay: "04-15", description: "Tax season — always top of mind for finance folks." },
  { name: "National Savings Day", category: "industry_specific" as const, industryTag: "finance", monthDay: "10-12", description: "A great reminder to save." },
  { name: "National Retirement Planning Week", category: "industry_specific" as const, industryTag: "finance", monthDay: "04-07", description: "First week of April." },

  // ─── Industry-Specific: Marketing / Sales ─────────────────────────────────
  { name: "National Sales Day", category: "industry_specific" as const, industryTag: "marketing", monthDay: "03-05", description: "For the closers in your network." },
  { name: "National Marketing Day", category: "industry_specific" as const, industryTag: "marketing", monthDay: "04-17", description: "Celebrating the marketers." },
  { name: "National Social Media Day", category: "industry_specific" as const, industryTag: "marketing", monthDay: "06-30", description: "For the digital folks in your world." },
  { name: "National Advertising Day", category: "industry_specific" as const, industryTag: "marketing", monthDay: "03-02", description: "Celebrating the creative side of business." },

  // ─── Industry-Specific: Legal ─────────────────────────────────────────────
  { name: "National Lawyers Day", category: "industry_specific" as const, industryTag: "legal", monthDay: "11-01", description: "Honoring the legal professionals." },
  { name: "Law Day", category: "industry_specific" as const, industryTag: "legal", monthDay: "05-01", description: "Celebrating the rule of law." },
  { name: "National Paralegal Day", category: "industry_specific" as const, industryTag: "legal", monthDay: "10-23", description: "For the paralegals and legal staff." },

  // ─── Industry-Specific: Technology ────────────────────────────────────────
  { name: "National Technology Day", category: "industry_specific" as const, industryTag: "technology", monthDay: "01-06", description: "For the tech folks in your network." },
  { name: "World IT Day", category: "industry_specific" as const, industryTag: "technology", monthDay: "06-17", description: "Celebrating information technology." },
  { name: "National Programmer Day", category: "industry_specific" as const, industryTag: "technology", monthDay: "09-13", description: "256th day of the year — for the coders." },

  // ─── Industry-Specific: Education ─────────────────────────────────────────
  { name: "National Teacher Appreciation Day", category: "industry_specific" as const, industryTag: "education", monthDay: "05-06", description: "First Tuesday of May — honoring teachers." },
  { name: "National Education Day", category: "industry_specific" as const, industryTag: "education", monthDay: "11-14", description: "Celebrating educators everywhere." },
  { name: "Back to School Season", category: "industry_specific" as const, industryTag: "education", monthDay: "08-15", description: "A great touchpoint for education folks in August." },
];
