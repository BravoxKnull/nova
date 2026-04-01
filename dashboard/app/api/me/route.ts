import { NextResponse } from "next/server";
import { getDashboardSession } from "../../../lib/session";

export async function GET(): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
  });
}
