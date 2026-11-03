import { db, getCandidateUser, unauthorized, extractText, hashText, parseResume, json, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Candidate portal: manage the logged-in candidate's resume versions

// ?id=1 returns one resume with its text; otherwise the list of versions
export async function GET(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const pool = await db();
    const id = new URL(request.url).searchParams.get("id");

    if (id) {
      const [rows] = await pool.query("SELECT * FROM resumes WHERE id = ? AND user_id = ?", [id, user.id]);
      if (!rows[0]) return Response.json({ error: "Resume not found." }, { status: 404 });
      const r = rows[0];
      return Response.json({ id: r.id, label: r.label, fileName: r.file_name, text: r.text, parsed: json(r.parsed, null), createdAt: r.created_at });
    }

    const [rows] = await pool.query(
      `SELECT r.id, r.label, r.file_name, r.parsed, r.created_at, CHAR_LENGTH(r.text) AS chars,
         (SELECT a.score FROM analyses a WHERE a.resume_id = r.id AND a.kind = 'ats' ORDER BY a.id DESC LIMIT 1) AS ats_score
       FROM resumes r WHERE r.user_id = ? ORDER BY r.id DESC`,
      [user.id]
    );
    return Response.json(rows.map((r) => ({ id: r.id, label: r.label, fileName: r.file_name, parsed: json(r.parsed, null), createdAt: r.created_at, chars: r.chars, atsScore: r.ats_score })));
  } catch {
    return Response.json({ error: "Could not load your resumes." }, { status: 500 });
  }
}

// Upload a new resume version (PDF or TXT)
export async function POST(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const form = await request.formData();
    const file = form.get("resume");
    const label = (form.get("label") || "").toString().trim();
    if (!file || typeof file === "string" || !file.size) return Response.json({ error: "Please choose a resume file (PDF or TXT)." }, { status: 400 });

    let text;
    try { text = (await extractText(file)).trim(); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    if (text.length < 50) return Response.json({ error: "We couldn't read enough text from this file. Try a text-based PDF or a TXT file." }, { status: 400 });

    const pool = await db();
    const hash = hashText(text);
    const [dup] = await pool.query("SELECT label FROM resumes WHERE user_id = ? AND hash = ?", [user.id, hash]);
    if (dup.length) return Response.json({ error: `You already uploaded this exact resume as "${dup[0].label}".` }, { status: 409 });

    // Structured extraction (education, experience, projects, skills...) checked against the text
    let parsed = null;
    if (process.env.OPENAI_API_KEY) {
      try { parsed = await parseResume(text); } catch {}
    }
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM resumes WHERE user_id = ?", [user.id]);
    const name = label || `Version ${n + 1}`;
    const [r] = await pool.query("INSERT INTO resumes (user_id, label, file_name, text, hash, parsed) VALUES (?, ?, ?, ?, ?, ?)", [
      user.id, name, file.name, text, hash, parsed ? JSON.stringify(parsed) : null,
    ]);
    await audit(user, "resume.upload", name);
    return Response.json({ id: r.insertId, parsed: !!parsed });
  } catch {
    return Response.json({ error: "Could not upload the resume." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    const id = new URL(request.url).searchParams.get("id");
    const pool = await db();
    await pool.query("DELETE FROM analyses WHERE resume_id = ? AND user_id = ?", [id, user.id]);
    await pool.query("DELETE FROM resumes WHERE id = ? AND user_id = ?", [id, user.id]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not delete the resume." }, { status: 500 });
  }
}
