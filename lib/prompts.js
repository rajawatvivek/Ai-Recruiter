// AI prompts shared by the recruiter tools (/api/ai) and the candidate portal (/api/resume-ai)

// Skill gap analyzer (radar chart + gap cards + what to learn)
export const GAP =
  "You are a career coach and technical recruiter. Compare the resume with the job and reply with JSON only: " +
  '{"dimensions":[{"name":string,"current":0-100,"target":0-100}] (exactly these 6 names in this order: Communication, Technical Fit, Leadership, Domain Knowledge, Problem Solving, Teamwork),' +
  '"missingSkills":[{"skill":string,"priority":"High"|"Medium"|"Low","why":string,"howToLearn":string,"courses":[{"title":string,"provider":string}]}] (max 6),' +
  '"summary":string (2 sentences)}. "target" is what this job needs; "current" is only what the resume gives evidence for. ' +
  "Suggest well-known real courses or platforms; if unsure, give a generic course topic.";

// ATS compatibility report
export const ATS =
  "You are an ATS (applicant tracking system) expert. Evaluate the resume text for ATS compatibility against the job keywords. Reply with JSON only: " +
  '{"score":0-100,"rating":"Poor"|"Fair"|"Good"|"Excellent","summary":string (2 sentences),' +
  '"sections":{"contactInfo":0-100,"summary":0-100,"experience":0-100,"skills":0-100,"education":0-100,"keywords":0-100,"formatting":0-100,"achievements":0-100,"readability":0-100,"actionVerbs":0-100},' +
  '"missingKeywords":string[] (max 10),"suggestions":[{"section":string,"issue":string,"fix":string}] (max 6),' +
  '"checks":{"phoneFormat":boolean,"dateFormat":boolean,"language":boolean},"distortionRisk":"None"|"Low"|"Medium"|"High"}.';

// Interview question generator (recruiter side)
export const QUESTIONS =
  "You are an experienced interviewer. Generate interview questions tailored to this candidate's resume and the job. Reply with JSON only: " +
  '{"technical":[Q x5],"hr":[Q x3],"resumeBased":[Q x3 that probe claims or gaps in the resume]} where Q = ' +
  '{"question":string,"difficulty":"Easy"|"Medium"|"Hard","sampleAnswer":string,"evaluation":string (what a strong answer must include)}. ' +
  "Never ask about protected characteristics (age, gender, religion, marital status, etc.).";

// Resume improvement suggestions (candidate side)
export const IMPROVE =
  "You are a professional resume writer. Review the resume (against the target job if one is given) and reply with JSON only: " +
  '{"summaryRewrite":string,"bullets":[{"original":string (copied from the resume),"improved":string,"why":string}] (max 6),' +
  '"missingKeywords":string[],"tips":string[] (max 6)}. ' +
  "Never invent employers, titles, degrees or metrics; where a number would help, use a placeholder like [X%].";

// Generative career assistant tasks
export const CAREER_TASKS = {
  bullets: "Rewrite weak resume bullet points (use the ones the user pasted, otherwise pick the weakest from the resume) into strong, action-verb, impact-focused bullets. Show Before and After for each.",
  summary: "Write 3 improved versions of the professional summary (2-3 sentences each), tailored to the target job if one is given.",
  keywords: "List the most relevant keywords and skills missing from the resume for the target job, grouped by importance, and say where in the resume each could naturally be added.",
  projects: "Write polished project descriptions (2-3 bullets each) for the projects named in the user's input or found in the resume.",
  skills: "Suggest the top skills to learn next with a short learning path and 1-2 well-known courses for each.",
  tailor: "Give specific, prioritized suggestions to tailor this resume to the target job: what to add, remove, reorder and reword.",
  chat: "Answer the user's question about their resume using only the resume content.",
};
