import { NextResponse } from "next/server";
import { clearDiscordSession } from "../../../../../lib/session";
import { getDashboardEnv } from "../../../../../lib/env";

export async function GET(): Promise<NextResponse> {
  const dashboardEnv = getDashboardEnv();
  await clearDiscordSession();
  return NextResponse.redirect(new URL("/", dashboardEnv.appUrl));
}
