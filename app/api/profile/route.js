import { db, getUser, unauthorized, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Update the logged-in user's profile (name, headline, company profile for recruiters, about)
export async function PUT(request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { name, headline, company, about } = await request.json();
    if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });
    const pool = await db();
    await pool.query("UPDATE users SET name = ?, headline = ?, company = ?, about = ? WHERE id = ?", [
      name.trim(), (headline || "").trim(), user.role === "candidate" ? null : (company || "").trim(), (about || "").trim(), user.id,
    ]);
    await audit(user, "profile.update", user.role);
    return Response.json({ user: { ...user, name: name.trim(), headline, company: user.role === "candidate" ? null : company, about } });
  } catch {
    return Response.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
