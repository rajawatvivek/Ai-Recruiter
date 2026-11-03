import { cookies } from "next/headers";
import { db, hashPassword, makeToken, audit } from "../../../lib/server";

export const runtime = "nodejs";

// Public sign-up for candidates and recruiters (admins are created by an existing admin)
export async function POST(request) {
  try {
    const { name, email, password, role, company } = await request.json();
    if (!name?.trim() || !email?.trim() || !password) return Response.json({ error: "Please fill in your name, email and password." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    const r = role === "recruiter" ? "recruiter" : "candidate";

    const pool = await db();
    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [email.trim()]);
    if (exists.length) return Response.json({ error: "An account with this email already exists." }, { status: 409 });

    const [ins] = await pool.query("INSERT INTO users (name, email, password_hash, role, company) VALUES (?, ?, ?, ?, ?)", [
      name.trim(), email.trim(), hashPassword(password), r, r === "recruiter" ? (company || "").trim() : null,
    ]);
    const user = { id: ins.insertId, name: name.trim(), email: email.trim(), role: r, company: company || null };
    cookies().set("session", makeToken(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    await audit(user, "register", `New ${r} account`);
    return Response.json({ user });
  } catch {
    return Response.json({ error: "Could not create the account. Check your database connection." }, { status: 500 });
  }
}
