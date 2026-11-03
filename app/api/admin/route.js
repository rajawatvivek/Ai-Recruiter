import { db, getAdmin, unauthorized, skillList, json, audit } from "../../../lib/server";

export const runtime = "nodejs";

const AGREE = { Shortlist: "Shortlisted", Maybe: "Review", Reject: "Rejected" };
const top = (counts, n) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([skill, count]) => ({ skill, count }));

// Admin data: ?section=overview | users | jobs | api | audit
export async function GET(request) {
  try {
    if (!(await getAdmin())) return unauthorized();
    const section = new URL(request.url).searchParams.get("section") || "overview";
    const pool = await db();
    const q = async (sql, a = []) => (await pool.query(sql, a))[0];

    if (section === "users") {
      return Response.json(await q("SELECT id, name, email, role, company FROM users ORDER BY id"));
    }

    if (section === "jobs") {
      const rows = await q("SELECT j.id, j.title, j.company, j.location, j.published, j.created_at, COUNT(c.id) AS candidates FROM jobs j LEFT JOIN candidates c ON c.job_id = j.id GROUP BY j.id ORDER BY j.id DESC");
      return Response.json(rows.map((r) => ({ ...r, published: !!r.published })));
    }

    if (section === "audit") {
      return Response.json(await q("SELECT id, user_name, action, detail, created_at FROM audit_logs ORDER BY id DESC LIMIT 100"));
    }

    if (section === "api") {
      const [t] = await q("SELECT COUNT(*) AS total, COALESCE(SUM(ok = 0), 0) AS errors, COALESCE(AVG(ms), 0) AS avgMs, COALESCE(SUM(tokens), 0) AS tokens FROM api_logs");
      return Response.json({
        total: Number(t.total), errors: Number(t.errors), avgMs: Math.round(Number(t.avgMs)), tokens: Number(t.tokens),
        byName: (await q("SELECT name, COUNT(*) AS calls, SUM(ok = 0) AS errors, ROUND(AVG(ms)) AS avgMs FROM api_logs GROUP BY name ORDER BY calls DESC")).map((r) => ({ ...r, errors: Number(r.errors), avgMs: Number(r.avgMs) })),
        daily: (await q("SELECT DATE_FORMAT(created_at, '%m-%d') AS d, COUNT(*) AS calls, SUM(ok = 0) AS errors FROM api_logs WHERE created_at > NOW() - INTERVAL 7 DAY GROUP BY d ORDER BY d")).map((r) => ({ ...r, errors: Number(r.errors) })),
        recentErrors: await q("SELECT name, error, ms, created_at FROM api_logs WHERE ok = 0 ORDER BY id DESC LIMIT 10"),
      });
    }

    // overview
    const [c] = await q(`SELECT (SELECT COUNT(*) FROM jobs) AS jobs, (SELECT COUNT(*) FROM jobs WHERE published = 1) AS published,
      (SELECT COUNT(*) FROM candidates) AS screened, (SELECT COUNT(*) FROM candidates WHERE user_id IS NOT NULL) AS applications,
      (SELECT COUNT(*) FROM resumes) AS resumes, (SELECT COUNT(*) FROM analyses) AS analyses, (SELECT COUNT(*) FROM interviews) AS interviews`);
    const roles = {};
    (await q("SELECT role, COUNT(*) AS n FROM users GROUP BY role")).forEach((r) => (roles[r.role] = r.n));
    const statuses = {};
    (await q("SELECT status, COUNT(*) AS n FROM candidates GROUP BY status")).forEach((r) => (statuses[r.status] = r.n));
    const perJob = (await q("SELECT j.title, COUNT(c.id) AS total, COALESCE(SUM(c.status = 'Shortlisted'), 0) AS shortlisted FROM jobs j LEFT JOIN candidates c ON c.job_id = j.id GROUP BY j.id")).map((r) => ({ title: r.title, total: r.total, shortlisted: Number(r.shortlisted) }));

    // Skills demand: how often each skill is requested by jobs, and which skills candidates most often lack
    const demand = {};
    (await q("SELECT required_skills, optional_skills FROM jobs WHERE published = 1")).forEach((j) => [...skillList(j.required_skills), ...skillList(j.optional_skills)].forEach((s) => (demand[s] = (demand[s] || 0) + 1)));
    const gaps = {};
    (await q("SELECT skill_overlap FROM candidates")).forEach((r) => json(r.skill_overlap, []).forEach((s) => s.match < 50 && (gaps[s.skill] = (gaps[s.skill] || 0) + 1)));

    // Feedback learning: how often recruiters agree with the AI, and a threshold suggested by their decisions
    const fb = await q("SELECT ai_recommendation, final_status, score FROM feedback");
    const agree = fb.filter((f) => AGREE[f.ai_recommendation] === f.final_status).length;
    const human = fb.filter((f) => f.final_status === "Shortlisted").map((f) => f.score);
    const th = await q("SELECT v FROM settings WHERE k = 'threshold'");

    return Response.json({
      counts: { ...c, candidates: roles.candidate || 0, recruiters: roles.recruiter || 0, admins: roles.admin || 0 },
      statuses, perJob, demand: top(demand, 10), gaps: top(gaps, 8),
      feedback: { total: fb.length, agree, suggested: human.length >= 3 ? Math.max(50, Math.floor(Math.min(...human) / 5) * 5) : null, threshold: Number(th[0]?.v) || 80 },
    });
  } catch {
    return Response.json({ error: "Could not load admin data." }, { status: 500 });
  }
}

// Change a user's role, or set the shortlist threshold
export async function PATCH(request) {
  try {
    const admin = await getAdmin();
    if (!admin) return unauthorized();
    const { userId, role, threshold } = await request.json();
    const pool = await db();
    if (threshold != null) {
      const t = Math.max(50, Math.min(95, Number(threshold) || 80));
      await pool.query("REPLACE INTO settings (k, v) VALUES ('threshold', ?)", [String(t)]);
      await audit(admin, "settings", `Shortlist threshold set to ${t}`);
      return Response.json({ ok: true });
    }
    if (!["admin", "recruiter", "candidate"].includes(role)) return Response.json({ error: "Invalid role." }, { status: 400 });
    if (Number(userId) === admin.id) return Response.json({ error: "You can't change your own role." }, { status: 400 });
    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
    await audit(admin, "user.role", `User #${userId} → ${role}`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update." }, { status: 500 });
  }
}

// Remove a user (?userId=) or a job (?jobId=)
export async function DELETE(request) {
  try {
    const admin = await getAdmin();
    if (!admin) return unauthorized();
    const p = new URL(request.url).searchParams;
    const pool = await db();
    if (p.get("userId")) {
      if (Number(p.get("userId")) === admin.id) return Response.json({ error: "You can't delete your own account." }, { status: 400 });
      await pool.query("DELETE FROM resumes WHERE user_id = ?", [p.get("userId")]);
      await pool.query("DELETE FROM users WHERE id = ?", [p.get("userId")]);
      await audit(admin, "user.delete", `User #${p.get("userId")}`);
    } else if (p.get("jobId")) {
      await pool.query("DELETE FROM jobs WHERE id = ?", [p.get("jobId")]);
      await audit(admin, "job.delete", `Job #${p.get("jobId")}`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not delete." }, { status: 500 });
  }
}
