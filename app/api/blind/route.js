import { cookies } from "next/headers";
import { getStaff, unauthorized, isBlind } from "../../../lib/server";

export const runtime = "nodejs";

// Turn blind screening (hiding names/contact details) on or off
export async function POST(request) {
  if (!(await getStaff())) return unauthorized();
  const { on } = await request.json();
  if (on) cookies().set("blind", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  else cookies().delete("blind");
  return Response.json({ blind: !!on });
}

export async function GET() {
  return Response.json({ blind: isBlind() });
}
