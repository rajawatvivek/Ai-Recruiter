import { db, getCandidateUser, unauthorized, callOpenAI, jobText } from "../../../lib/server";
import { CAREER_TASKS } from "../../../lib/prompts";

export const runtime = "nodejs";

// Generative AI career assistant: rewrite bullets, summaries, keywords, project descriptions, skills, tailoring, resume Q&A
export async function POST(request) {
  try {
    const user = await getCandidateUser();
    if (!user) return unauthorized();
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Server is missing OPENAI_API_KEY in .env.local." }, { status: 500 });
    const { task, resumeId, jobId, input, history } = await request.json();
    if (!CAREER_TASKS[task]) return Response.json({ error: "Unknown task." }, { status: 400 });

    const pool = await db();
    const [res] = await pool.query("SELECT text FROM resumes WHERE id = ? AND user_id = ?", [resumeId, user.id]);
    if (!res[0]) return Response.json({ error: "Please choose a resume first." }, { status: 400 });
    let job = null;
    if (jobId) {
      const [j] = await pool.query("SELECT * FROM jobs WHERE id = ? AND published = 1", [jobId]);
      job = j[0] || null;
    }
    if (task === "chat" && !input?.trim()) return Response.json({ error: "Please type a question." }, { status: 400 });

    const completion = await callOpenAI("career", {
      messages: [
        {
          role: "system",
          content:
            "You are a careful career coach. Use ONLY facts found in the resume; never invent employers, dates, degrees or numbers - use placeholders like [X%] when a metric is needed. " +
            "Be concise and use short headings and bullet lists in plain text.\nTASK: " + CAREER_TASKS[task] +
            `\n\n${job ? jobText(job) : "TARGET JOB: not specified"}\n\nRESUME:\n${res[0].text.slice(0, 12000)}`,
        },
        ...(task === "chat" && Array.isArray(history) ? history.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content) })) : []),
        { role: "user", content: input?.trim() || "Go ahead." },
      ],
    });
    return Response.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    const msg = err?.status ? "AI service error, please try again." : "The assistant could not answer. Please try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
