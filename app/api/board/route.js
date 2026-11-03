import { db, getCandidateUser, unauthorized, skillList, analyze, insertCandidate, getThreshold, statusFor, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Job board for candidates: published jobs, ranked by how well the chosen resume covers each job's skills
export async function GET(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const resumeId = new URL(request.url).searchParams.get("resumeId");
    const pool = await db();

    let hay = "";
    if (resumeId) {
      const [r] = await pool.query("SELECT text FROM resumes WHERE id = ? AND user_id = ?", [resumeId, user.id]);
      hay = (r[0]?.text || "").toLowerCase();
    }
    const [jobs] = await pool.query(
      `SELECT j.*, (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id AND c.user_id = ?) AS applied
       FROM jobs j WHERE j.published = 1 ORDER BY j.id DESC`,
      [user.id]
    );

    // Personalized recommendation: required skills count double
    const out = jobs.map((j) => {
      const req = skillList(j.required_skills);
      const opt = skillList(j.optional_skills);
      const has = (s) => !!hay && hay.includes(s.toLowerCase());
      const total = req.length * 2 + opt.length;
      const got = req.filter(has).length * 2 + opt.filter(has).length;
      return {
        id: j.id, title: j.title, company: j.company, location: j.location, description: j.description, applied: j.applied > 0,
        match: hay && total ? Math.round((got / total) * 100) : null,
        skills: [...req.map((s) => ({ skill: s, required: true, has: has(s) })), ...opt.map((s) => ({ skill: s, required: false, has: has(s) }))],
      };
    });
    out.sort((a, b) => (b.match ?? -1) - (a.match ?? -1));
    return Response.json(out);
  } catch {
    return Response.json({ error: "Could not load jobs." }, { status: 500 });
  }
}

// Apply to a job with a chosen resume version; the AI screens it and the recruiter sees the application
export async function POST(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });
    const { jobId, resumeId } = await request.json();
    if (!jobId || !resumeId) return Response.json({ error: "Please choose a resume to apply with." }, { status: 400 });

    const pool = await db();
    const [jobs] = await pool.query("SELECT * FROM jobs WHERE id = ? AND published = 1", [jobId]);
    const [res] = await pool.query("SELECT label, text FROM resumes WHERE id = ? AND user_id = ?", [resumeId, user.id]);
    if (!jobs[0]) return Response.json({ error: "This job is no longer open." }, { status: 404 });
    if (!res[0]) return Response.json({ error: "Resume not found." }, { status: 404 });

    const [already] = await pool.query("SELECT id FROM candidates WHERE job_id = ? AND user_id = ?", [jobId, user.id]);
    if (already.length) return Response.json({ error: "You have already applied to this job." }, { status: 409 });

    const r = await analyze(jobs[0], res[0].text);
    r.name = user.name; // the verified account name
    r.email = user.email;
    const status = statusFor(r.score, await getThreshold(pool));
    await insertCandidate(pool, { jobId, fileName: res[0].label, text: res[0].text, r, status, userId: user.id });
    await audit(user, "apply", `Applied to ${jobs[0].title}`);
    return Response.json({ score: r.score });
  } catch (err) {
    const msg = err?.status ? "AI service error, please try again." : "Could not submit your application. Please try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
