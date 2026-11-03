import { db, getCandidateUser, unauthorized, json } from "../../../lib/server";

export const runtime = "nodejs";

// The candidate's own applications with their current status and any scheduled interview
export async function GET() {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const pool = await db();
    const [rows] = await pool.query(
      `SELECT c.id, c.score, c.status, c.created_at, c.skill_overlap, c.file_name, j.title, j.company, j.location,
         (SELECT DATE_FORMAT(MIN(i.scheduled_at), '%Y-%m-%dT%H:%i') FROM interviews i WHERE i.candidate_id = c.id) AS interview_at
       FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.user_id = ? ORDER BY c.id DESC`,
      [user.id]
    );
    return Response.json(
      rows.map((r) => {
        const o = json(r.skill_overlap, []);
        return {
          id: r.id, title: r.title, company: r.company, location: r.location, score: r.score, status: r.status, resume: r.file_name,
          createdAt: r.created_at, interviewAt: r.interview_at,
          matched: o.filter((s) => s.match >= 50).map((s) => s.skill),
          missing: o.filter((s) => s.match < 50).map((s) => s.skill),
        };
      })
    );
  } catch {
    return Response.json({ error: "Could not load your applications." }, { status: 500 });
  }
}
