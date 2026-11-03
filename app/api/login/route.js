import { cookies } from "next/headers";
import { db, checkPassword, makeToken, getUser, unauthorized, isBlind, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Current session
export async function GET() {
  try {
    const user = await getUser();
    return user ? Response.json({ user, blind: isBlind() }) : unauthorized();
  } catch {
    return Response.json({ error: "Cannot connect to the database. Check your MySQL settings in .env.local." }, { status: 500 });
  }
}

// Log in
export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

    const pool = await db();
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim()]);
    const u = rows[0];
    if (!u || !checkPassword(password, u.password_hash)) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    cookies().set("session", makeToken(u.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    const user = { id: u.id, name: u.name, email: u.email, role: u.role, company: u.company, about: u.about, headline: u.headline };
    await audit(user, "login", "Signed in");
    return Response.json({ user });
  } catch {
    return Response.json({ error: "Cannot connect to the database. Check your MySQL settings in .env.local." }, { status: 500 });
  }
}

// Log out
export async function DELETE() {
  cookies().delete("session");
  return Response.json({ ok: true });
}
