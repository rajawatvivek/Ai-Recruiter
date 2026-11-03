import { db, getStaff, unauthorized, skillList, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Comma / newline separated text or array -> clean string array
const toList = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean);

// List jobs with candidate counts (recruiters and admins)
export async function GET() {
  try {
    if (!(await getStaff())) return unauthorized();
    const pool = await db();
    const [rows] = await pool.query(
      `SELECT j.*, COUNT(c.id) AS candidates
       FROM jobs j LEFT JOIN candidates c ON c.job_id = j.id
       GROUP BY j.id ORDER BY j.id DESC`
    );
    return Response.json(rows.map((r) => ({ ...r, requiredSkills: skillList(r.required_skills), optionalSkills: skillList(r.optional_skills), published: !!r.published })));
  } catch {
    return Response.json({ error: "Could not load jobs." }, { status: 500 });
  }
}

// Create a job with required / optional skills
export async function POST(request) {
  try {
    const user = await getStaff();
    if (!user) return unauthorized();
    const { title, location, description, company, requiredSkills, optionalSkills, published } = await request.json();
    if (!title?.trim() || !description?.trim()) {
      return Response.json({ error: "Job title and description are required." }, { status: 400 });
    }
    const pool = await db();
    const [r] = await pool.query(
      "INSERT INTO jobs (title, location, description, company, required_skills, optional_skills, published) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title.trim(), (location || "").trim(), description.trim(), (company || user.company || "").trim(), JSON.stringify(toList(requiredSkills)), JSON.stringify(toList(optionalSkills)), published === false ? 0 : 1]
    );
    await audit(user, "job.create", `Created ${title.trim()}`);
    return Response.json({ id: r.insertId });
  } catch {
    return Response.json({ error: "Could not save the job." }, { status: 500 });
  }
}

// Publish / unpublish a job
export async function PATCH(request) {
  try {
    const user = await getStaff();
    if (!user) return unauthorized();
    const { id, published } = await request.json();
    const pool = await db();
    await pool.query("UPDATE jobs SET published = ? WHERE id = ?", [published ? 1 : 0, id]);
    await audit(user, published ? "job.publish" : "job.unpublish", `Job #${id}`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update the job." }, { status: 500 });
  }
}
