import { getStaff, unauthorized, listCandidates } from "../../../lib/server";

export const runtime = "nodejs";

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`; // CSV-escape a value

// Download the (filtered) candidate list as a CSV report
export async function GET(request) {
  try {
    if (!(await getStaff())) return unauthorized();
    const rows = await listCandidates(new URL(request.url).searchParams);
    const header = ["Rank", "Candidate", "Email", "Phone", "Job", "Score", "Status", "Recommendation", "Matched Skills", "Missing Skills", "Summary"];
    const lines = rows.map((c, i) =>
      [i + 1, c.name, c.email, c.phone, c.jobTitle, c.score, c.status, c.recommendation, c.matched.join("; "), c.missing.join("; "), c.summary]
        .map(cell)
        .join(",")
    );
    return new Response([header.map(cell).join(","), ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="candidate-report.csv"',
      },
    });
  } catch {
    return Response.json({ error: "Could not generate the report." }, { status: 500 });
  }
}
