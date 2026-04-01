import { buildDiscordInstallUrl, canManageGuild, type DiscordGuild } from "./discord";

export interface DashboardGuildViewModel {
  id: string;
  name: string;
  icon: string | null;
  canManage: boolean;
  installUrl: string;
  botInstalled: boolean;
}

export function mapGuildsForDashboard(
  guilds: readonly DiscordGuild[],
  installedGuildIds: ReadonlySet<string>,
): DashboardGuildViewModel[] {
  return guilds
    .filter((guild) => canManageGuild(guild))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : null,
      canManage: true,
      installUrl: buildDiscordInstallUrl(guild.id),
      botInstalled: installedGuildIds.has(guild.id),
    }));
}
