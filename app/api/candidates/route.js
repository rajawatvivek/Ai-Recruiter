import { db, getStaff, unauthorized, shape, mask, listCandidates, audit } from "../../../lib/server";

export const runtime = "nodejs";

const STATUSES = ["Shortlisted", "Review", "Rejected"];

// ?id=1 returns full details; otherwise a filtered list (q, jobId, status)
export async function GET(request) {
  try {
    if (!(await getStaff())) return unauthorized();
    const params = new URL(request.url).searchParams;
    const id = params.get("id");

    if (!id) return Response.json(await listCandidates(params));

    const pool = await db();
    const [rows] = await pool.query(
      `SELECT c.*, j.title AS job_title, j.location AS job_location, j.description AS job_description
       FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.id = ?`,
      [id]
    );
    if (!rows[0]) return Response.json({ error: "Candidate not found." }, { status: 404 });
    const candidate = shape(rows[0]);

    // Rank among candidates screened for the same job, plus the closest competitors
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM candidates WHERE job_id = ?", [candidate.jobId]);
    const [[{ better }]] = await pool.query(
      "SELECT COUNT(*) AS better FROM candidates WHERE job_id = ? AND score > ?",
      [candidate.jobId, candidate.score]
    );
    const [similar] = await pool.query(
      "SELECT id, name, score FROM candidates WHERE job_id = ? AND id <> ? ORDER BY score DESC LIMIT 3",
      [candidate.jobId, id]
    );
    return Response.json({ candidate, rank: better + 1, total, similar: similar.map((s) => ({ ...s, name: mask(s.id, s.name) })) });
  } catch {
    return Response.json({ error: "Could not load candidates." }, { status: 500 });
  }
}

// Update candidate status (Shortlisted / Review / Rejected)
export async function PATCH(request) {
  try {
    const user = await getStaff();
    if (!user) return unauthorized();
    const { id, status } = await request.json();
    if (!id || !STATUSES.includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const pool = await db();
    const [cur] = await pool.query("SELECT name, score, recommendation FROM candidates WHERE id = ?", [id]);
    await pool.query("UPDATE candidates SET status = ? WHERE id = ?", [status, id]);
    if (cur[0]) {
      // Recruiter feedback: compare the human decision with the AI recommendation (used for feedback learning)
      await pool.query("INSERT INTO feedback (candidate_id, user_id, ai_recommendation, final_status, score) VALUES (?, ?, ?, ?, ?)", [id, user.id, cur[0].recommendation, status, cur[0].score]);
      await audit(user, "candidate.status", `${cur[0].name} → ${status}`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update the candidate." }, { status: 500 });
  }
}
