import { NextResponse } from "next/server";
import { fetchDiscordGuilds } from "../../../lib/discord";
import { mapGuildsForDashboard } from "../../../lib/guilds";
import { getDashboardSession } from "../../../lib/session";

export async function GET(): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const guilds = await fetchDiscordGuilds(session.accessToken);
  return NextResponse.json({
    authenticated: true,
    guilds: mapGuildsForDashboard(guilds, (guildId) => `install:${guildId}`),
  });
}
