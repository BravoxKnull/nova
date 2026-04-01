import { NextResponse } from "next/server";
import { buildDiscordLoginUrl } from "../../../../../lib/discord";
import { createLoginState } from "../../../../../lib/session";

export async function GET(): Promise<NextResponse> {
  const state = await createLoginState();
  return NextResponse.redirect(buildDiscordLoginUrl(state));
}
