import { db, getStaff, unauthorized, mask, isBlind } from "../../../lib/server";

export const runtime = "nodejs";

// Times are stored/returned as plain local "YYYY-MM-DDTHH:mm" strings (no timezone conversion)
const AT = "DATE_FORMAT(i.scheduled_at, '%Y-%m-%dT%H:%i')";

// List all interviews
export async function GET() {
  try {
    if (!(await getStaff())) return unauthorized();
    const pool = await db();
    const [rows] = await pool.query(
      `SELECT i.id, i.candidate_id, i.duration, i.mode, i.notes, ${AT} AS at, c.name, c.title, j.title AS job_title
       FROM interviews i JOIN candidates c ON c.id = i.candidate_id JOIN jobs j ON j.id = c.job_id
       ORDER BY i.scheduled_at`
    );
    return Response.json(
      rows.map((r) => ({
        id: r.id,
        candidateId: r.candidate_id,
        name: mask(r.candidate_id, r.name),
        title: r.title,
        jobTitle: r.job_title,
        at: r.at,
        duration: r.duration,
        mode: r.mode,
        notes: r.notes,
      }))
    );
  } catch {
    return Response.json({ error: "Could not load interviews." }, { status: 500 });
  }
}

// Schedule an interview and return a ready-to-send invitation email
export async function POST(request) {
  try {
    const user = await getStaff();
    if (!user) return unauthorized();
    const { candidateId, at, duration, mode, notes } = await request.json();

    if (!candidateId) return Response.json({ error: "Please choose a candidate." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at || "")) return Response.json({ error: "Please pick a date and time." }, { status: 400 });
    const mins = Number(duration) || 45;
    const start = at.replace("T", " ") + ":00";

    const pool = await db();
    const [cand] = await pool.query(
      "SELECT c.id, c.name, c.email, j.title AS job FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.id = ?",
      [candidateId]
    );
    if (!cand[0]) return Response.json({ error: "Candidate not found." }, { status: 404 });

    // Prevent double-booking overlapping slots
    const [clash] = await pool.query(
      `SELECT id FROM interviews
       WHERE scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE) AND DATE_ADD(scheduled_at, INTERVAL duration MINUTE) > ?`,
      [start, mins, start]
    );
    if (clash.length) return Response.json({ error: "That time overlaps another interview. Please pick a different slot." }, { status: 409 });

    const [r] = await pool.query(
      "INSERT INTO interviews (candidate_id, scheduled_at, duration, mode, notes) VALUES (?, ?, ?, ?, ?)",
      [candidateId, start, mins, mode || "Video call", (notes || "").trim()]
    );

    // Draft the invitation (sent from the HR user's own email app)
    const when = new Date(at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" });
    const first = cand[0].name.split(" ")[0];
    const invite = {
      to: isBlind() ? "" : cand[0].email,
      subject: `Interview invitation - ${cand[0].job}`,
      body:
        `Hi ${first},\n\nThank you for applying for the ${cand[0].job} role. We were impressed with your profile and would like to invite you to an interview.\n\n` +
        `Date & time: ${when}\nDuration: ${mins} minutes\nFormat: ${mode || "Video call"}\n${notes?.trim() ? `Notes: ${notes.trim()}\n` : ""}\n` +
        `Please reply to confirm that this slot works for you.\n\nBest regards,\n${user.name}\nHireSense AI Recruitment`,
    };
    return Response.json({ id: r.insertId, invite });
  } catch {
    return Response.json({ error: "Could not schedule the interview." }, { status: 500 });
  }
}

// Cancel an interview
export async function DELETE(request) {
  try {
    if (!(await getStaff())) return unauthorized();
    const id = new URL(request.url).searchParams.get("id");
    const pool = await db();
    await pool.query("DELETE FROM interviews WHERE id = ?", [id]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not cancel the interview." }, { status: 500 });
  }
}
