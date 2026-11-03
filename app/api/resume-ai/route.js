import { db, getCandidateUser, unauthorized, json, callOpenAI, jobText } from "../../../lib/server";
import { GAP, ATS, IMPROVE } from "../../../lib/prompts";

export const runtime = "nodejs";

const PROMPTS = { ats: ATS, gap: GAP, improve: IMPROVE };

// History of analyses for a resume (?resumeId=) or one saved analysis (?analysisId=)
export async function GET(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const p = new URL(request.url).searchParams;
    const pool = await db();
    if (p.get("analysisId")) {
      const [r] = await pool.query("SELECT kind, data FROM analyses WHERE id = ? AND user_id = ?", [p.get("analysisId"), user.id]);
      return r[0] ? Response.json({ kind: r[0].kind, data: json(r[0].data, {}) }) : Response.json({ error: "Not found." }, { status: 404 });
    }
    const [rows] = await pool.query(
      `SELECT a.id, a.kind, a.score, a.created_at, j.title AS job_title
       FROM analyses a LEFT JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? AND a.resume_id = ? ORDER BY a.id DESC`,
      [user.id, p.get("resumeId")]
    );
    return Response.json(rows.map((r) => ({ id: r.id, kind: r.kind, score: r.score, jobTitle: r.job_title, createdAt: r.created_at })));
  } catch {
    return Response.json({ error: "Could not load the history." }, { status: 500 });
  }
}

// Run (or fetch the saved) ATS report / improvement suggestions / skill gap for one resume
export async function POST(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const { resumeId, kind, jobId, refresh } = await request.json();
    if (!PROMPTS[kind] || !resumeId) return Response.json({ error: "Invalid request." }, { status: 400 });

    const pool = await db();
    const [res] = await pool.query("SELECT text FROM resumes WHERE id = ? AND user_id = ?", [resumeId, user.id]);
    if (!res[0]) return Response.json({ error: "Resume not found." }, { status: 404 });

    // Saved result for the same resume + analysis + job
    if (!refresh) {
      const [c] = await pool.query("SELECT id, data FROM analyses WHERE user_id = ? AND resume_id = ? AND kind = ? AND job_id <=> ? ORDER BY id DESC LIMIT 1", [user.id, resumeId, kind, jobId || null]);
      if (c[0]) return Response.json({ id: c[0].id, data: json(c[0].data, {}), cached: true });
    }
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });

    let job = null;
    if (jobId) {
      const [j] = await pool.query("SELECT * FROM jobs WHERE id = ? AND published = 1", [jobId]);
      job = j[0] || null;
    }
    const completion = await callOpenAI("resume-" + kind, {
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPTS[kind] },
        { role: "user", content: `${job ? jobText(job) : "JOB: none selected - give a general assessment for the role this resume is aiming at"}\n\nRESUME:\n${res[0].text.slice(0, 12000)}` },
      ],
    });
    const data = JSON.parse(completion.choices[0].message.content);
    const score = kind === "ats" ? Math.max(0, Math.min(100, Math.round(Number(data.score) || 0))) : null;
    const [ins] = await pool.query("INSERT INTO analyses (user_id, resume_id, job_id, kind, score, data) VALUES (?, ?, ?, ?, ?, ?)", [user.id, resumeId, jobId || null, kind, score, JSON.stringify(data)]);
    return Response.json({ id: ins.insertId, data });
  } catch (err) {
    const msg = err?.status ? "AI service error, please try again." : "Could not analyze the resume. Please try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
