import type { GuildRuntimeConfig } from "../types/moderation";

export interface GuildConfigProvider {
  getGuildRuntimeConfig(guildId: string): Promise<GuildRuntimeConfig>;
}
