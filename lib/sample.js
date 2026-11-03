import crypto from "crypto";
// Sample jobs + candidates inserted automatically so the dashboard isn't empty.
// Each sample job is added only if a job with that title doesn't exist yet.
// Set SEED_SAMPLE_DATA=false in .env.local to skip.

// people: [name, current title, location, years, overall score, per-skill match % (same order as the job's skills)]
const JOBS = [
  {
    title: "Senior Backend Engineer",
    location: "Bengaluru, India",
    description:
      "Build and scale distributed systems and APIs in a cloud environment.\n\nKey requirements:\n- 6+ years of backend development experience\n- Strong Python, FastAPI, Node.js\n- Experience with PostgreSQL, Redis\n- AWS services (ECS, RDS, S3, Lambda)\n- Kafka or other messaging systems\n- RESTful API design and microservices\n- System design and scalability",
    skills: ["Python", "FastAPI", "PostgreSQL", "AWS", "Kafka", "Node.js", "Redis", "Docker", "System Design", "Kubernetes"],
    people: [
      ["Aviral Mehta", "Sr. Backend Engineer", "Bengaluru, India", 6, 92, [100, 100, 100, 90, 80, 70, 100, 100, 80, 60]],
      ["Sanya Kapoor", "Backend Engineer", "Pune, India", 5, 89, [100, 90, 100, 85, 70, 80, 90, 100, 75, 55]],
      ["Pranav Verma", "Software Engineer II", "Hyderabad, India", 7, 87, [95, 80, 100, 90, 60, 90, 85, 95, 85, 50]],
      ["Neha Gupta", "Platform Engineer", "Bengaluru, India", 6, 85, [90, 75, 90, 100, 85, 40, 80, 100, 80, 90]],
      ["Rohit Bansal", "Backend Developer", "Gurugram, India", 5, 78, [90, 60, 85, 70, 55, 85, 70, 90, 60, 40]],
      ["Rahul Iyer", "Full Stack Developer", "Chennai, India", 4, 64, [70, 40, 80, 55, 20, 90, 60, 70, 50, 20]],
      ["Simran Kaur", "Software Developer", "Chandigarh, India", 3, 58, [75, 30, 70, 40, 10, 80, 50, 60, 40, 10]],
      ["Karan Das", "Junior Developer", "Kolkata, India", 2, 38, [50, 10, 40, 20, 0, 60, 30, 40, 20, 0]],
    ],
  },
  {
    title: "MERN Stack Developer",
    location: "Remote",
    description:
      "Develop modern web applications end to end.\n\nKey requirements:\n- React.js and JavaScript/TypeScript\n- Node.js and Express.js\n- MongoDB data modelling\n- REST API design\n- Git and code review workflow",
    skills: ["React.js", "Node.js", "MongoDB", "Express.js", "JavaScript", "REST APIs", "Git", "TypeScript"],
    people: [
      ["Ishita Rao", "Full Stack Developer", "Remote", 4, 91, [100, 95, 100, 100, 100, 90, 100, 80]],
      ["Arjun Nair", "MERN Developer", "Kochi, India", 3, 84, [95, 90, 85, 90, 100, 85, 90, 50]],
      ["Kabir Malhotra", "Software Engineer", "Noida, India", 3, 80, [90, 85, 80, 85, 95, 80, 85, 60]],
      ["Meera Joshi", "Frontend Developer", "Mumbai, India", 3, 72, [100, 55, 40, 50, 95, 70, 85, 75]],
      ["Riya Kulkarni", "Web Developer", "Nagpur, India", 2, 61, [80, 50, 55, 45, 85, 60, 70, 20]],
      ["Vikram Singh", "Web Developer", "Delhi, India", 1, 45, [60, 30, 20, 30, 70, 40, 65, 10]],
    ],
  },
  {
    title: "Data Analyst",
    location: "Mumbai, India",
    description:
      "Turn data into insights for business teams.\n\nKey requirements:\n- Strong SQL and Excel\n- Python (Pandas) for analysis\n- Dashboards in Tableau or Power BI\n- Solid grasp of statistics",
    skills: ["SQL", "Python", "Excel", "Tableau", "Statistics", "Power BI", "Pandas"],
    people: [
      ["Ananya Sharma", "Senior Data Analyst", "Mumbai, India", 5, 88, [100, 90, 95, 90, 85, 70, 90]],
      ["Harsh Vyas", "Data Analyst", "Pune, India", 3, 82, [95, 85, 90, 80, 75, 85, 80]],
      ["Dev Patel", "Business Analyst", "Ahmedabad, India", 3, 67, [85, 50, 100, 60, 55, 70, 40]],
      ["Tanvi Shah", "MIS Executive", "Surat, India", 2, 41, [60, 20, 90, 10, 30, 20, 10]],
    ],
  },
  {
    title: "DevOps Engineer",
    location: "Hyderabad, India",
    description:
      "Own CI/CD, infrastructure and reliability.\n\nKey requirements:\n- AWS or Azure cloud experience\n- Docker and Kubernetes\n- Terraform / infrastructure as code\n- CI/CD pipelines (Jenkins, GitHub Actions)\n- Monitoring (Prometheus, Grafana)\n- Linux and scripting",
    skills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Prometheus", "Linux", "Bash"],
    people: [
      ["Siddharth Menon", "Senior DevOps Engineer", "Hyderabad, India", 7, 90, [100, 100, 95, 90, 100, 85, 95, 90]],
      ["Pooja Reddy", "Cloud Engineer", "Bengaluru, India", 5, 83, [95, 90, 85, 80, 85, 70, 90, 85]],
      ["Amit Chauhan", "Systems Engineer", "Jaipur, India", 4, 68, [70, 80, 60, 50, 75, 40, 90, 85]],
      ["Nikhil Jain", "IT Support Engineer", "Indore, India", 2, 42, [40, 50, 20, 10, 30, 10, 70, 60]],
    ],
  },
  {
    title: "Machine Learning Engineer",
    location: "Remote",
    description:
      "Build and deploy ML models to production.\n\nKey requirements:\n- Python, scikit-learn, PyTorch or TensorFlow\n- NLP experience\n- Model deployment (FastAPI, Docker)\n- SQL and data pipelines\n- Strong statistics foundation",
    skills: ["Python", "PyTorch", "scikit-learn", "NLP", "FastAPI", "Docker", "SQL", "Statistics"],
    people: [
      ["Aditi Bhatt", "ML Engineer", "Remote", 5, 93, [100, 95, 100, 95, 85, 80, 90, 95]],
      ["Yash Agarwal", "Data Scientist", "Bengaluru, India", 4, 81, [100, 80, 95, 85, 55, 60, 90, 90]],
      ["Lavanya Pillai", "AI Research Intern", "Chennai, India", 1, 66, [90, 70, 80, 75, 30, 40, 60, 80]],
    ],
  },
  {
    title: "UI/UX Designer",
    location: "Pune, India",
    description:
      "Design intuitive product experiences.\n\nKey requirements:\n- Figma and prototyping\n- User research and usability testing\n- Design systems\n- Wireframing and information architecture\n- Collaboration with engineers",
    skills: ["Figma", "Prototyping", "User Research", "Design Systems", "Wireframing", "Usability Testing"],
    people: [
      ["Mansi Deshmukh", "Product Designer", "Pune, India", 5, 89, [100, 95, 85, 90, 95, 80]],
      ["Rishabh Arora", "UI Designer", "Delhi, India", 3, 74, [95, 85, 55, 70, 80, 50]],
      ["Zoya Khan", "Graphic Designer", "Lucknow, India", 2, 52, [70, 50, 30, 40, 60, 20]],
    ],
  },
];

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const COMPANY = "Acme Technologies";
const hash = (t) => crypto.createHash("sha256").update(t.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
// First ~70% of a job's skills are "required", the rest "optional"
const splitSkills = (skills) => {
  const n = Math.ceil(skills.length * 0.7);
  return [skills.slice(0, n), skills.slice(n)];
};

// Builds every stored field for one sample candidate
function build(job, [name, title, location, years, score, match]) {
  const overlap = job.skills.map((skill, i) => ({ skill, match: match[i], required: i < Math.ceil(job.skills.length * 0.7) }));
  const matched = overlap.filter((s) => s.match >= 70).map((s) => s.skill);
  const missing = overlap.filter((s) => s.match < 50).map((s) => s.skill);
  const email = `${name.toLowerCase().replace(/ /g, ".")}@mail.com`;
  const phone = "+91 98765 43210";
  const degree = score >= 60 ? "B.Tech in Computer Science" : "B.Sc in Information Technology";
  const institution = "State Technical University";
  const cert = score >= 80 ? "AWS Certified Cloud Practitioner" : "";
  const project = `${job.title.split(" ")[0]} Platform Migration`;
  const bullets = [
    `Delivered projects using ${matched.slice(0, 3).join(", ") || "core tools"} for customer-facing products`,
    "Collaborated with cross-functional teams and mentored junior colleagues",
    "Improved performance and reliability of key services",
  ];

  // A short realistic resume so the AI features (ATS, skill gap, interview questions) have text to analyse
  const resume = [
    name,
    `${title} | ${location}`,
    `Email: ${email} | Phone: ${phone}`,
    "",
    "SUMMARY",
    `${title} with ${years} year${years === 1 ? "" : "s"} of experience delivering production projects. Comfortable working across teams and owning features end to end.`,
    "",
    "SKILLS",
    [...(matched.length ? matched : ["General programming"]), "Communication", "Teamwork"].join(", "),
    "",
    "EXPERIENCE",
    `${title} - ${COMPANY} (${years} yrs)`,
    ...bullets.map((b) => "- " + b),
    "",
    "PROJECTS",
    `${project} - migrated a legacy service to a modern stack with zero downtime`,
    "",
    "EDUCATION",
    `${degree} - ${institution}, 2018`,
    ...(cert ? ["", "CERTIFICATIONS", cert] : []),
  ].join("\n");

  const parsed = {
    education: [{ degree, institution, year: "2018" }],
    experience: [{ role: title, company: COMPANY, duration: `${years} yrs`, highlights: bullets }],
    projects: [{ name: project, description: "Migrated a legacy service to a modern stack with zero downtime" }],
    certifications: cert ? [cert] : [],
    technicalSkills: matched.length ? matched : ["General programming"],
    softSkills: ["Communication", "Teamwork"],
    sections: ["Summary", "Skills", "Experience", "Projects", "Education", ...(cert ? ["Certifications"] : [])],
  };
  parsed.verification = { checked: 4 + (cert ? 1 : 0) + parsed.technicalSkills.length + 2, removed: 0 };

  return {
    name, title, location, years, score, overlap, email, phone, resume, parsed, hash: hash(resume),
    skillsScore: clamp(match.reduce((a, b) => a + b, 0) / match.length),
    experienceScore: clamp(score - 2),
    domainScore: clamp(score - 4),
    educationScore: clamp(score - 12),
    status: score >= 80 ? "Shortlisted" : score >= 60 ? "Review" : "Rejected",
    recommendation: score >= 80 ? "Shortlist" : score >= 60 ? "Maybe" : "Reject",
    reasons: [
      matched.length ? `Strong overlap in ${matched.slice(0, 3).join(", ")}` : "Limited overlap with the required skills",
      `${years} year${years === 1 ? "" : "s"} of experience as ${title}`,
      missing.length ? `Gaps in ${missing.slice(0, 2).join(" and ")}` : "Covers all key requirements for the role",
    ],
    strengths: {
      skills: matched.slice(0, 3),
      experience: [`${years}+ years`, title.split(" ").slice(-1)[0]],
      domain: score >= 60 ? ["Relevant domain", "Production systems"] : ["Early career"],
      education: [score >= 60 ? "B.Tech / B.Sc" : "Graduate"],
    },
    summary:
      score >= 80
        ? `${name} is a top match for this role and is highly recommended for the shortlist.`
        : score >= 60
          ? `${name} meets some requirements but has gaps; worth a closer review.`
          : `${name} has limited alignment with the job requirements.`,
  };
}

export async function seedSampleData(pool) {
  let day = 0; // spread created_at over the last couple of weeks

  for (const job of JOBS) {
    const [req, opt] = splitSkills(job.skills);
    const [exists] = await pool.query("SELECT id FROM jobs WHERE title = ?", [job.title]);
    if (exists.length) {
      // Upgrade jobs/candidates created by earlier seeds with the newer fields
      await pool.query("UPDATE jobs SET required_skills = ?, optional_skills = ?, company = ? WHERE title = ? AND required_skills IS NULL", [JSON.stringify(req), JSON.stringify(opt), COMPANY, job.title]);
      for (const p of job.people) {
        const c = build(job, p);
        await pool.query("UPDATE candidates SET resume_text = ?, parsed = ?, resume_hash = ?, skill_overlap = ? WHERE email = ? AND parsed IS NULL", [c.resume, JSON.stringify(c.parsed), c.hash, JSON.stringify(c.overlap), c.email]);
      }
      continue;
    }

    const [j] = await pool.query(
      "INSERT INTO jobs (title, location, description, company, required_skills, optional_skills, published) VALUES (?, ?, ?, ?, ?, ?, 1)",
      [job.title, job.location, job.description, COMPANY, JSON.stringify(req), JSON.stringify(opt)]
    );

    for (const p of job.people) {
      const c = build(job, p);
      await pool.query(
        `INSERT INTO candidates (job_id, file_name, name, email, phone, title, location, years_exp, score,
           skills_score, experience_score, domain_score, education_score, skill_overlap, reasons, strengths,
           summary, recommendation, status, resume_text, parsed, resume_hash, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [j.insertId, `${c.name.replace(/ /g, "_")}_Resume.pdf`, c.name, c.email, c.phone, c.title, c.location, c.years, c.score,
         c.skillsScore, c.experienceScore, c.domainScore, c.educationScore,
         JSON.stringify(c.overlap), JSON.stringify(c.reasons), JSON.stringify(c.strengths),
         c.summary, c.recommendation, c.status, c.resume, JSON.stringify(c.parsed), c.hash, day++ % 14]
      );
    }
  }

  // Sample interview slots this week for the best shortlisted candidates
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM interviews");
  if (!n) {
    const [top] = await pool.query("SELECT id FROM candidates WHERE status = 'Shortlisted' ORDER BY score DESC LIMIT 7");
    const slots = [[0, "10:00"], [0, "14:30"], [1, "11:00"], [2, "09:30"], [2, "15:00"], [3, "12:00"], [4, "16:00"]];
    const modes = ["Video call", "Video call", "On-site", "Video call", "Phone", "Video call", "On-site"];
    for (let i = 0; i < top.length; i++) {
      await pool.query(
        "INSERT INTO interviews (candidate_id, scheduled_at, duration, mode, notes) VALUES (?, TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL ? DAY), ?), 45, ?, 'Technical round')",
        [top[i].id, slots[i][0], slots[i][1] + ":00", modes[i]]
      );
    }
  }
}

// Two resume versions (weaker v1, improved v2) for the demo candidate, plus saved ATS reports so version comparison works instantly
export async function seedDemoResumes(pool, userId) {
  const [ex] = await pool.query("SELECT id FROM resumes WHERE user_id = ?", [userId]);
  if (ex.length) return;
  const job = JOBS[0];
  const v1 = build(job, ["Aviral Mehta", "Backend Developer", "Bengaluru, India", 4, 70, [80, 70, 80, 60, 30, 60, 50, 60, 40, 10]]);
  const v2 = build(job, job.people[0]);
  const atsData = (score, sections, missingKeywords) => ({
    score,
    rating: score >= 80 ? "Good" : "Fair",
    summary: score >= 80 ? "Well structured resume with strong keyword coverage." : "Several keyword and formatting gaps are limiting ATS performance.",
    sections,
    missingKeywords,
    suggestions: [{ section: "Achievements", issue: "Few measurable results", fix: "Add numbers, e.g. reduced latency by [X%]" }],
    checks: { phoneFormat: true, dateFormat: true, language: true },
    distortionRisk: "None",
  });
  const secs = (a) => Object.fromEntries(["contactInfo", "summary", "experience", "skills", "education", "keywords", "formatting", "achievements", "readability", "actionVerbs"].map((k, i) => [k, a[i]]));

  const [r1] = await pool.query("INSERT INTO resumes (user_id, label, file_name, text, hash, parsed, created_at) VALUES (?, 'Resume v1 (2024)', 'Aviral_Mehta_v1.pdf', ?, ?, ?, DATE_SUB(NOW(), INTERVAL 40 DAY))", [userId, v1.resume, v1.hash, JSON.stringify(v1.parsed)]);
  const [r2] = await pool.query("INSERT INTO resumes (user_id, label, file_name, text, hash, parsed, created_at) VALUES (?, 'Resume v2 (improved)', 'Aviral_Mehta_v2.pdf', ?, ?, ?, DATE_SUB(NOW(), INTERVAL 3 DAY))", [userId, v2.resume, v2.hash, JSON.stringify(v2.parsed)]);
  await pool.query("INSERT INTO analyses (user_id, resume_id, kind, score, data, created_at) VALUES (?, ?, 'ats', 64, ?, DATE_SUB(NOW(), INTERVAL 39 DAY))", [userId, r1.insertId, JSON.stringify(atsData(64, secs([90, 60, 65, 70, 75, 40, 70, 45, 68, 50]), ["Kafka", "Kubernetes", "System Design"]))]);
  await pool.query("INSERT INTO analyses (user_id, resume_id, kind, score, data, created_at) VALUES (?, ?, 'ats', 82, ?, DATE_SUB(NOW(), INTERVAL 2 DAY))", [userId, r2.insertId, JSON.stringify(atsData(82, secs([100, 80, 82, 92, 85, 78, 85, 70, 80, 74]), ["Kubernetes"]))]);
  // Link the demo candidate to the matching sample application so "My Applications" isn't empty
  await pool.query("UPDATE candidates SET user_id = ? WHERE email = 'aviral.mehta@mail.com' AND user_id IS NULL", [userId]);
}

// Sample API-usage, audit-trail and recruiter-feedback rows so the admin pages have content
export async function seedMonitoring(pool) {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM api_logs");
  if (n) return;
  const names = ["screen", "screen", "ai-ats", "ai-gap", "ai-questions", "chat", "career", "parse"];
  for (let i = 0; i < 40; i++) {
    const ok = i % 11 !== 7;
    await pool.query("INSERT INTO api_logs (name, ok, ms, tokens, error, created_at) VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))", [
      names[i % names.length], ok ? 1 : 0, 700 + ((i * 137) % 2300), ok ? 800 + ((i * 211) % 2600) : 0, ok ? null : "429 Rate limit reached for requests", i * 4,
    ]);
  }
  const logs = [
    ["HR Admin", "login", "Signed in"],
    ["Rohit Sharma", "job.create", "Created Senior Backend Engineer"],
    ["Rohit Sharma", "screen", "Screened 8 resumes for Senior Backend Engineer"],
    ["Rohit Sharma", "candidate.status", "Aviral Mehta → Shortlisted"],
    ["Rohit Sharma", "interview.schedule", "Scheduled Aviral Mehta"],
    ["Aviral Mehta", "resume.upload", "Uploaded Resume v2 (improved)"],
    ["Aviral Mehta", "apply", "Applied to Senior Backend Engineer"],
    ["HR Admin", "settings", "Shortlist threshold set to 80"],
  ];
  for (let i = 0; i < logs.length; i++) {
    await pool.query("INSERT INTO audit_logs (user_name, action, detail, created_at) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))", [...logs[i], (logs.length - i) * 5]);
  }

  // Recruiter feedback vs AI recommendation (two humans shortlisted candidates the AI only rated "Maybe")
  const [cands] = await pool.query("SELECT id, score, recommendation, status FROM candidates ORDER BY score DESC LIMIT 14");
  for (const c of cands) {
    const final = c.score >= 72 && c.score < 80 ? "Shortlisted" : c.status;
    await pool.query("INSERT INTO feedback (candidate_id, ai_recommendation, final_status, score) VALUES (?, ?, ?, ?)", [c.id, c.recommendation, final, c.score]);
  }
}
