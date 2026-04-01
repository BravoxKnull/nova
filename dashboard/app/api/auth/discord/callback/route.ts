import { NextRequest, NextResponse } from "next/server";
import { assertLoginState, createSessionFromAuthorizationCode } from "../../../../../lib/session";
import { getDashboardEnv } from "../../../../../lib/env";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const dashboardEnv = getDashboardEnv();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?error=discord_oauth_denied", dashboardEnv.appUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=discord_oauth_invalid", dashboardEnv.appUrl));
  }

  try {
    await assertLoginState(state);
    await createSessionFromAuthorizationCode(code);
    return NextResponse.redirect(new URL("/dashboard", dashboardEnv.appUrl));
  } catch {
    return NextResponse.redirect(new URL("/?error=discord_oauth_failed", dashboardEnv.appUrl));
  }
}
