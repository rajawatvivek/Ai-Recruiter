import { db, getStaff, unauthorized, mask, json, callOpenAI } from "../../../lib/server";

export const runtime = "nodejs";

// HR chatbot: answers questions using the candidate database as context
export async function POST(request) {
  try {
    if (!(await getStaff())) return unauthorized();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });
    }
    const { message, history } = await request.json();
    if (!message?.trim()) return Response.json({ error: "Please type a question." }, { status: 400 });

    const pool = await db();
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.title, c.years_exp, c.score, c.status, c.location, c.skill_overlap, j.title AS job
       FROM candidates c JOIN jobs j ON j.id = c.job_id ORDER BY c.score DESC LIMIT 150`
    );

    // One compact line per candidate keeps the prompt small
    const data = rows
      .map((r) => {
        const o = json(r.skill_overlap, []);
        const has = o.filter((s) => s.match >= 50).map((s) => s.skill).join(", ");
        const lacks = o.filter((s) => s.match < 50).map((s) => s.skill).join(", ");
        return `${mask(r.id, r.name)} | ${r.title} | ${r.years_exp} yrs | job: ${r.job} | score ${r.score} | ${r.status} | ${r.location} | skills: ${has || "-"} | missing: ${lacks || "-"}`;
      })
      .join("\n");

    const completion = await callOpenAI("chat", {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are HireSense, an HR assistant. Answer ONLY from the candidate data below; if the data can't answer, say so. " +
            "Be concise, mention candidate names with their scores, and use short bullet lists. " +
            "Never judge candidates on protected characteristics (age, gender, religion, etc.). Scores assist HR; the final decision is theirs.\n\n" +
            "CANDIDATES (name | title | experience | job | score | status | location | skills | missing):\n" + data,
        },
        ...(Array.isArray(history) ? history.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content) })) : []),
        { role: "user", content: message },
      ],
    });
    return Response.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    const msg = err?.status ? "AI service error, please try again." : "The assistant could not answer. Please try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
