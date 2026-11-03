// Server-only helpers: MySQL, auth, resume text extraction, AI analysis
import mysql from "mysql2/promise";
import OpenAI from "openai";
import crypto from "crypto";
import { cookies } from "next/headers";
import { seedSampleData, seedDemoResumes, seedMonitoring } from "./sample";
import pdf from "pdf-parse/lib/pdf-parse.js"; // import the lib file directly to avoid pdf-parse's debug-mode bug

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

/* ---------- Database ---------- */

// Adds a column only if it doesn't exist yet (lets old databases upgrade in place)
async function addColumn(pool, table, col, def) {
  const [r] = await pool.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, col]
  );
  if (!r.length) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
}

// Creates the database, tables and a default admin user on first use
async function init() {
  const base = {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  };
  const name = process.env.MYSQL_DATABASE || "hireai";

  const conn = await mysql.createConnection(base);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
  await conn.end();

  const pool = mysql.createPool({ ...base, database: name, connectionLimit: 5 });

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    location VARCHAR(150),
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    file_name VARCHAR(255),
    name VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(50),
    title VARCHAR(150),
    location VARCHAR(150),
    years_exp DECIMAL(4,1) DEFAULT 0,
    score INT DEFAULT 0,
    skills_score INT DEFAULT 0,
    experience_score INT DEFAULT 0,
    domain_score INT DEFAULT 0,
    education_score INT DEFAULT 0,
    skill_overlap JSON,
    reasons JSON,
    strengths JSON,
    summary TEXT,
    recommendation VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Review',
    resume_text MEDIUMTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  )`);
  // Cached AI outputs per candidate (skill gap, ATS analysis, interview questions)
  await pool.query(`CREATE TABLE IF NOT EXISTS candidate_ai (
    candidate_id INT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (candidate_id, kind),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    duration INT DEFAULT 45,
    mode VARCHAR(30) DEFAULT 'Video call',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  )`);

  // Columns added after the first version (safe to run repeatedly)
  await addColumn(pool, "users", "role", "VARCHAR(20) DEFAULT 'recruiter'");
  await addColumn(pool, "users", "company", "VARCHAR(150)");
  await addColumn(pool, "users", "about", "TEXT");
  await addColumn(pool, "users", "headline", "VARCHAR(150)");
  await addColumn(pool, "jobs", "company", "VARCHAR(150)");
  await addColumn(pool, "jobs", "required_skills", "JSON");
  await addColumn(pool, "jobs", "optional_skills", "JSON");
  await addColumn(pool, "jobs", "published", "TINYINT DEFAULT 1");
  await addColumn(pool, "candidates", "user_id", "INT NULL");
  await addColumn(pool, "candidates", "resume_hash", "VARCHAR(64)");
  await addColumn(pool, "candidates", "parsed", "JSON");

  // Candidate portal: resume versions + analysis history
  await pool.query(`CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(100),
    file_name VARCHAR(255),
    text MEDIUMTEXT,
    hash VARCHAR(64),
    parsed JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS analyses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    resume_id INT NOT NULL,
    job_id INT NULL,
    kind VARCHAR(20) NOT NULL,
    score INT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // Admin: audit trail, API usage/error monitoring, recruiter feedback, settings
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_name VARCHAR(100),
    action VARCHAR(60),
    detail VARCHAR(300),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(40),
    ok TINYINT DEFAULT 1,
    ms INT DEFAULT 0,
    tokens INT DEFAULT 0,
    error VARCHAR(300),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    user_id INT NULL,
    ai_recommendation VARCHAR(20),
    final_status VARCHAR(20),
    score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query("CREATE TABLE IF NOT EXISTS settings (k VARCHAR(50) PRIMARY KEY, v VARCHAR(255))");

  // Seed the default admin (plus demo recruiter and candidate accounts when sample data is on)
  const adminEmail = process.env.ADMIN_EMAIL || "admin@hireai.com";
  const accounts = [["HR Admin", adminEmail, process.env.ADMIN_PASSWORD || "admin123", "admin", "HireSense AI"]];
  if (process.env.SEED_SAMPLE_DATA !== "false") {
    accounts.push(
      ["Rohit Sharma", "recruiter@hireai.com", "recruiter123", "recruiter", "Acme Technologies"],
      ["Aviral Mehta", "candidate@hireai.com", "candidate123", "candidate", null]
    );
  }
  for (const [uname, email, pw, role, company] of accounts) {
    const [u] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (!u.length) await pool.query("INSERT INTO users (name, email, password_hash, role, company) VALUES (?, ?, ?, ?, ?)", [uname, email, hashPassword(pw), role, company]);
  }
  await pool.query("UPDATE users SET role = 'admin' WHERE email = ?", [adminEmail]);

  // Demo data for an empty database (disable with SEED_SAMPLE_DATA=false)
  if (process.env.SEED_SAMPLE_DATA !== "false") {
    await seedSampleData(pool);
    const [cu] = await pool.query("SELECT id FROM users WHERE email = 'candidate@hireai.com'");
    if (cu[0]) await seedDemoResumes(pool, cu[0].id);
    await seedMonitoring(pool);
  }
  return pool;
}

// Cache the pool across hot reloads in dev
export function db() {
  // The key carries a schema version so hot reloads re-run init() after the schema changes
  return (globalThis.__hireaiPool3 ||= init().catch((e) => {
    console.error("Database init failed:", e.message);
    globalThis.__hireaiPool3 = null; // allow retry after a failed connect
    throw e;
  }));
}

/* ---------- Auth (signed cookie, scrypt password hashes) ---------- */

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}

export function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sign = (id) => crypto.createHmac("sha256", SECRET).update(String(id)).digest("hex");
export const makeToken = (id) => `${id}.${sign(id)}`;

// Returns the logged-in user or null
export async function getUser() {
  const token = cookies().get("session")?.value || "";
  const [id, sig] = token.split(".");
  if (!id || !sig || sig !== sign(id)) return null;
  const pool = await db();
  const [rows] = await pool.query("SELECT id, name, email, role, company, about, headline FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export const unauthorized = () => Response.json({ error: "Please log in." }, { status: 401 });

// Blind screening: when on, names/emails/phones never leave the server (reduces bias in first-pass review)
export const isBlind = () => cookies().get("blind")?.value === "1";
export const mask = (id, name) => (isBlind() ? `Candidate #${id}` : name);

/* ---------- Resume text extraction ---------- */

export async function extractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const data = await pdf(Buffer.from(await file.arrayBuffer()));
    return data.text;
  }
  if (name.endsWith(".txt")) return await file.text();
  throw new Error("Unsupported file type (use PDF or TXT)");
}

/* ---------- AI analysis ---------- */

const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const list = (v) => (Array.isArray(v) ? v.map(String) : []);

// Parses a JSON column (MySQL returns objects, MariaDB returns strings)
export const json = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v;
};

/* ---------- Candidate queries ---------- */

// Converts a DB row to the camelCase shape used by the frontend
export function shape(row) {
  const overlap = json(row.skill_overlap, []);
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    jobLocation: row.job_location,
    jobDescription: row.job_description,
    fileName: isBlind() ? `resume_${row.id}` : row.file_name,
    name: mask(row.id, row.name),
    email: isBlind() ? "" : row.email,
    phone: isBlind() ? "" : row.phone,
    title: row.title,
    location: row.location,
    yearsExp: Number(row.years_exp),
    score: row.score,
    skillsScore: row.skills_score,
    experienceScore: row.experience_score,
    domainScore: row.domain_score,
    educationScore: row.education_score,
    skillOverlap: overlap,
    matched: overlap.filter((s) => s.match >= 50).map((s) => s.skill),
    missing: overlap.filter((s) => s.match < 50).map((s) => s.skill),
    reasons: json(row.reasons, []),
    strengths: json(row.strengths, {}),
    summary: row.summary,
    recommendation: row.recommendation,
    status: row.status,
    parsed: json(row.parsed, null),
    userId: row.user_id ?? null,
    createdAt: row.created_at,
  };
}

// Search + filter (q, jobId, status), highest score first
export async function listCandidates(params) {
  const pool = await db();
  const where = [];
  const args = [];
  const q = (params.get("q") || "").trim();
  if (q) {
    where.push("(c.name LIKE ? OR c.email LIKE ? OR c.title LIKE ? OR c.file_name LIKE ?)");
    args.push(...Array(4).fill(`%${q}%`));
  }
  if (params.get("jobId")) { where.push("c.job_id = ?"); args.push(params.get("jobId")); }
  if (params.get("status")) { where.push("c.status = ?"); args.push(params.get("status")); }

  const [rows] = await pool.query(
    `SELECT c.id, c.job_id, c.file_name, c.name, c.email, c.phone, c.title, c.location, c.years_exp,
            c.score, c.skills_score, c.experience_score, c.domain_score, c.education_score,
            c.skill_overlap, c.reasons, c.strengths, c.summary, c.recommendation, c.status, c.created_at,
            j.title AS job_title
     FROM candidates c JOIN jobs j ON j.id = c.job_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY c.score DESC, c.id DESC`,
    args
  );
  return rows.map(shape);
}

/* ---------- Roles, audit log, OpenAI wrapper ---------- */

export async function getStaff() {
  const u = await getUser();
  return u && (u.role === "admin" || u.role === "recruiter") ? u : null;
}
export async function getCandidateUser() {
  const u = await getUser();
  return u && u.role === "candidate" ? u : null;
}
export async function getAdmin() {
  const u = await getUser();
  return u && u.role === "admin" ? u : null;
}

// Writes an entry to the audit trail (never throws)
export async function audit(user, action, detail = "") {
  try {
    const pool = await db();
    await pool.query("INSERT INTO audit_logs (user_id, user_name, action, detail) VALUES (?, ?, ?, ?)", [
      user?.id || null,
      user?.name || "",
      action,
      String(detail).slice(0, 300),
    ]);
  } catch {}
}

// Every OpenAI call goes through here so usage, latency and errors are logged for the admin monitor
export async function callOpenAI(name, params) {
  const t = Date.now();
  const pool = await db();
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({ model: "gpt-4o-mini", ...params });
    pool.query("INSERT INTO api_logs (name, ok, ms, tokens) VALUES (?, 1, ?, ?)", [name, Date.now() - t, r.usage?.total_tokens || 0]).catch(() => {});
    return r;
  } catch (e) {
    pool.query("INSERT INTO api_logs (name, ok, ms, error) VALUES (?, 0, ?, ?)", [name, Date.now() - t, String(e.message).slice(0, 300)]).catch(() => {});
    throw e;
  }
}

/* ---------- Resume AI: screening, structured parsing, hallucination control ---------- */

export const hashText = (t) => crypto.createHash("sha256").update(t.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
export const skillList = (v) => {
  const a = json(v, []);
  return Array.isArray(a) ? a.map(String) : [];
};

// Job text sent to the AI, including required / optional skills
export function jobText(job) {
  const req = skillList(job.required_skills);
  const opt = skillList(job.optional_skills);
  return (
    `JOB: ${job.title}${job.company ? " at " + job.company : ""}\n${job.description}` +
    (req.length ? `\nRequired skills: ${req.join(", ")}` : "") +
    (opt.length ? `\nOptional skills: ${opt.join(", ")}` : "")
  );
}

const PROFILE_SHAPE =
  '"profile":{"education":[{"degree":string,"institution":string,"year":string}],"experience":[{"role":string,"company":string,"duration":string,"highlights":string[]}],' +
  '"projects":[{"name":string,"description":string}],"certifications":string[],"technicalSkills":string[],"softSkills":string[],"sections":string[] (resume section headings found)} ' +
  "- include ONLY facts explicitly written in the resume; never invent anything";

// Hallucination control: drop extracted items that do not actually appear in the resume text
export function verifyProfile(p, text) {
  p = p || {};
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  const has = (s) => !!s && hay.includes(String(s).toLowerCase().trim());
  let checked = 0;
  let removed = 0;
  const keep = (arr, test) =>
    (Array.isArray(arr) ? arr : []).filter((x) => {
      checked++;
      const ok = test(x);
      if (!ok) removed++;
      return ok;
    });
  return {
    profile: {
      education: keep(p.education, (e) => has(e?.institution) || has(e?.degree)),
      experience: keep(p.experience, (e) => has(e?.company) || has(e?.role)),
      projects: keep(p.projects, (x) => has(x?.name)),
      certifications: keep(p.certifications, has),
      technicalSkills: keep(p.technicalSkills, has),
      softSkills: keep(p.softSkills, has),
      sections: Array.isArray(p.sections) ? p.sections.map(String) : [],
    },
    verification: { checked, removed },
  };
}

// Contact details are only kept when they really appear in the resume
const digits = (s) => String(s || "").replace(/\D/g, "");
const verifiedContact = (r, text) => ({
  email: r.email && text.toLowerCase().includes(String(r.email).toLowerCase()) ? String(r.email) : "",
  phone: r.phone && digits(r.phone).length >= 6 && digits(text).includes(digits(r.phone)) ? String(r.phone) : "",
});

// Screens one resume against a job: match scores + structured profile
export async function analyze(job, resumeText) {
  const completion = await callOpenAI("screen", {
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert technical recruiter. Semantically compare the resume with the job (consider equivalent skills, projects and context, not just keywords). Required skills matter more than optional ones. Reply with JSON only: " +
          '{"name":string,"email":string,"phone":string,"currentTitle":string,"location":string,"yearsExperience":number,' +
          '"score":0-100,"skillsScore":0-100,"experienceScore":0-100,"domainScore":0-100,"educationScore":0-100,' +
          '"skillOverlap":[{"skill":string,"match":0-100,"required":boolean}] (one entry per required and optional skill listed in the job; if none are listed, infer them from the description),' +
          '"reasons":string[] (3-5 short reasons why the candidate matches or not),' +
          '"strengths":{"skills":string[],"experience":string[],"domain":string[],"education":string[]} (short tags),' +
          '"summary":string (1-2 sentences),"recommendation":"Shortlist"|"Maybe"|"Reject",' + PROFILE_SHAPE + "}. " +
          'Use "" for details not found in the resume and "Unknown" if the name is missing.',
      },
      { role: "user", content: `${jobText(job)}\n\nRESUME:\n${resumeText.slice(0, 12000)}` },
    ],
  });
  const r = JSON.parse(completion.choices[0].message.content);
  const st = r.strengths || {};
  const { profile, verification } = verifyProfile(r.profile, resumeText);
  return {
    name: String(r.name || "Unknown"),
    ...verifiedContact(r, resumeText),
    title: String(r.currentTitle || ""),
    location: String(r.location || ""),
    yearsExp: Math.max(0, Number(r.yearsExperience) || 0),
    score: clamp(r.score),
    skillsScore: clamp(r.skillsScore),
    experienceScore: clamp(r.experienceScore),
    domainScore: clamp(r.domainScore),
    educationScore: clamp(r.educationScore),
    skillOverlap: Array.isArray(r.skillOverlap)
      ? r.skillOverlap.map((o) => ({ skill: String(o.skill), match: clamp(o.match), required: o.required !== false }))
      : [],
    reasons: list(r.reasons),
    strengths: { skills: list(st.skills), experience: list(st.experience), domain: list(st.domain), education: list(st.education) },
    summary: String(r.summary || ""),
    recommendation: ["Shortlist", "Maybe", "Reject"].includes(r.recommendation) ? r.recommendation : "Maybe",
    parsed: { ...profile, verification },
  };
}

// Converts unstructured resume text into structured JSON (no job needed)
export async function parseResume(resumeText) {
  const completion = await callOpenAI("parse", {
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract structured data from the resume. Reply with JSON only: " +
          '{"name":string,"email":string,"phone":string,"headline":string,"location":string,"yearsExperience":number,' + PROFILE_SHAPE + "}.",
      },
      { role: "user", content: resumeText.slice(0, 12000) },
    ],
  });
  const r = JSON.parse(completion.choices[0].message.content);
  const { profile, verification } = verifyProfile(r.profile, resumeText);
  return { name: String(r.name || ""), ...verifiedContact(r, resumeText), headline: String(r.headline || ""), location: String(r.location || ""), yearsExp: Number(r.yearsExperience) || 0, ...profile, verification };
}

/* ---------- Shortlist threshold (feedback learning) + candidate insert ---------- */

export async function getThreshold(pool) {
  const [r] = await pool.query("SELECT v FROM settings WHERE k = 'threshold'");
  return Number(r[0]?.v) || 80;
}
export const statusFor = (score, th) => (score >= th ? "Shortlisted" : score >= th - 20 ? "Review" : "Rejected");

export async function insertCandidate(pool, { jobId, fileName, text, r, status, userId = null }) {
  const [res] = await pool.query(
    `INSERT INTO candidates (job_id, file_name, name, email, phone, title, location, years_exp, score,
       skills_score, experience_score, domain_score, education_score, skill_overlap, reasons, strengths,
       summary, recommendation, status, resume_text, user_id, resume_hash, parsed)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [jobId, fileName, r.name, r.email, r.phone, r.title, r.location, r.yearsExp, r.score,
     r.skillsScore, r.experienceScore, r.domainScore, r.educationScore,
     JSON.stringify(r.skillOverlap), JSON.stringify(r.reasons), JSON.stringify(r.strengths),
     r.summary, r.recommendation, status, text, userId, hashText(text), JSON.stringify(r.parsed)]
  );
  return res.insertId;
}
