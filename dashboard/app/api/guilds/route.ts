import { NextResponse } from "next/server";
import { canManageGuild, fetchDiscordGuilds, getInstalledBotGuildIds } from "../../../lib/discord";
import { mapGuildsForDashboard } from "../../../lib/guilds";
import { getDashboardSession } from "../../../lib/session";

export async function GET(): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const guilds = await fetchDiscordGuilds(session.accessToken);
  const manageableGuilds = guilds.filter((guild) => canManageGuild(guild));
  const installedGuildIds = await getInstalledBotGuildIds(manageableGuilds.map((guild) => guild.id));
  return NextResponse.json({
    authenticated: true,
    guilds: mapGuildsForDashboard(guilds, installedGuildIds),
  });
}
