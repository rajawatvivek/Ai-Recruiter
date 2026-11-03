import { db, getStaff, unauthorized, json, callOpenAI, jobText } from "../../../lib/server";
import { GAP, ATS, QUESTIONS } from "../../../lib/prompts";

export const runtime = "nodejs";

// One prompt per recruiter AI tool; results are cached per candidate in the candidate_ai table
const PROMPTS = { gap: GAP, ats: ATS, questions: QUESTIONS };

export async function POST(request) {
  try {
    if (!(await getStaff())) return unauthorized();
    const { candidateId, kind, refresh } = await request.json();
    if (!PROMPTS[kind] || !candidateId) return Response.json({ error: "Invalid request." }, { status: 400 });

    const pool = await db();

    // Serve the cached result unless a refresh was requested
    if (!refresh) {
      const [cached] = await pool.query("SELECT data FROM candidate_ai WHERE candidate_id = ? AND kind = ?", [candidateId, kind]);
      if (cached[0]) return Response.json({ data: json(cached[0].data, {}), cached: true });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });
    }
    const [rows] = await pool.query(
      `SELECT c.resume_text, j.title, j.description, j.company, j.required_skills, j.optional_skills
       FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.id = ?`,
      [candidateId]
    );
    if (!rows[0]) return Response.json({ error: "Candidate not found." }, { status: 404 });

    const completion = await callOpenAI("ai-" + kind, {
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPTS[kind] },
        { role: "user", content: `${jobText(rows[0])}\n\nRESUME:\n${(rows[0].resume_text || "").slice(0, 12000)}` },
      ],
    });
    const data = JSON.parse(completion.choices[0].message.content);

    await pool.query("REPLACE INTO candidate_ai (candidate_id, kind, data) VALUES (?, ?, ?)", [candidateId, kind, JSON.stringify(data)]);
    return Response.json({ data });
  } catch (err) {
    const msg = err?.status ? "AI service error, please try again." : "Could not generate the analysis. Please try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
