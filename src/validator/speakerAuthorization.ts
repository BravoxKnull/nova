import type { GuildMember } from "discord.js";
import type { GuildRuntimeConfig } from "../types/moderation";

export function isSpeakerAllowed(member: GuildMember, config: GuildRuntimeConfig): boolean {
  if (config.allowedSpeakers.length === 0) {
    return false;
  }

  return config.allowedSpeakers.some((rule) => {
    if (rule.type === "USER") {
      return rule.discordUserId === member.id;
    }

    return member.roles.cache.has(rule.discordRoleId);
  });
}
