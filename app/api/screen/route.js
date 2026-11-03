import { db, getStaff, unauthorized, extractText, analyze, hashText, insertCandidate, getThreshold, statusFor, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Batch-screen uploaded resumes against a saved job and store results in MySQL
export async function POST(request) {
  try {
    const user = await getStaff();
    if (!user) return unauthorized();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });
    }

    const form = await request.formData();
    const jobId = form.get("jobId");
    const files = form.getAll("resumes").filter((f) => typeof f !== "string" && f.size > 0);
    if (!jobId) return Response.json({ error: "Please select a job." }, { status: 400 });
    if (!files.length) return Response.json({ error: "Please upload at least one resume." }, { status: 400 });

    const pool = await db();
    const [jobs] = await pool.query("SELECT * FROM jobs WHERE id = ?", [jobId]);
    if (!jobs[0]) return Response.json({ error: "Job not found." }, { status: 404 });
    const threshold = await getThreshold(pool);
    const seen = new Set(); // hashes already handled in this batch

    // Process resumes in parallel; one failure shouldn't break the rest
    const outcomes = await Promise.all(
      files.map(async (file) => {
        try {
          const text = (await extractText(file)).trim();
          if (!text) throw new Error("No readable text found in file");

          // Duplicate detection: identical resume text already screened for this job (or earlier in this batch)
          const h = hashText(text);
          const [dup] = await pool.query("SELECT name FROM candidates WHERE job_id = ? AND resume_hash = ?", [jobId, h]);
          if (dup.length || seen.has(h)) throw new Error(`Duplicate resume${dup[0] ? " of " + dup[0].name : ""} - skipped`);
          seen.add(h);

          const r = await analyze(jobs[0], text);
          await insertCandidate(pool, { jobId, fileName: file.name, text, r, status: statusFor(r.score, threshold) });
          return { fileName: file.name, ok: true };
        } catch (err) {
          const msg = err?.status ? "AI service error, please try again." : err.message;
          return { fileName: file.name, ok: false, error: msg };
        }
      })
    );

    const saved = outcomes.filter((o) => o.ok).length;
    await audit(user, "screen", `Screened ${saved} resume(s) for ${jobs[0].title}`);
    return Response.json({ saved, failed: outcomes.filter((o) => !o.ok) });
  } catch {
    return Response.json({ error: "Something went wrong while screening. Please try again." }, { status: 500 });
  }
}
