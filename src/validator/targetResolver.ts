import type { Collection, Guild, GuildMember } from "discord.js";
import { normalizeText } from "../normalization/normalizeText";
import type { CommandName } from "../types/moderation";

export type TargetResolutionResult =
  | {
      ok: true;
      target: GuildMember;
    }
  | {
      ok: false;
      reason: string;
    };

export class TargetResolver {
  public resolveTarget(
    guild: Guild,
    speaker: GuildMember,
    commandName: CommandName,
    targetPhrase: string,
    botUserId?: string,
  ): TargetResolutionResult {
    const normalizedTarget = normalizeText(targetPhrase);
    if (!normalizedTarget) {
      return {
        ok: false,
        reason: "Target user phrase is empty",
      };
    }

    const candidateMembers =
      commandName === "drag"
        ? Array.from(guild.voiceStates.cache.values())
            .map((voiceState) => voiceState.member)
            .filter((member): member is GuildMember => Boolean(member))
        : Array.from(speaker.voice.channel?.members.values() ?? []);

    const matches = candidateMembers.filter((member) => {
      if (member.id === speaker.id) {
        return false;
      }

      if (botUserId && member.id === botUserId) {
        return false;
      }

      if (!member.voice.channelId) {
        return false;
      }

      const normalizedDisplayName = normalizeText(member.displayName);
      const normalizedUsername = normalizeText(member.user.username);

      return normalizedDisplayName === normalizedTarget || normalizedUsername === normalizedTarget;
    });

    if (matches.length === 0) {
      return {
        ok: false,
        reason: "Target user was not found",
      };
    }

    if (matches.length > 1) {
      return {
        ok: false,
        reason: "Target user match is ambiguous",
      };
    }

    return {
      ok: true,
      target: matches[0]!,
    };
  }
}
