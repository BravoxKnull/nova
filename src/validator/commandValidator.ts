import type { Guild, GuildMember } from "discord.js";
import type { GuildRuntimeConfig, ParsedCommand } from "../types/moderation";
import { isSpeakerAllowed } from "./speakerAuthorization";
import { TargetResolver, type TargetResolutionResult } from "./targetResolver";

export type CommandValidationResult =
  | {
      ok: true;
      target: GuildMember;
    }
  | {
      ok: false;
      reason: string;
      targetUserId?: string;
    };

export class CommandValidator {
  public constructor(private readonly targetResolver: TargetResolver) {}

  public validate(params: {
    guild: Guild;
    speaker: GuildMember;
    parsedCommand: ParsedCommand;
    guildConfig: GuildRuntimeConfig;
    botMember: GuildMember | null;
  }): CommandValidationResult {
    const { guild, speaker, parsedCommand, guildConfig, botMember } = params;

    if (!guildConfig.enabledCommands.has(parsedCommand.commandName)) {
      return {
        ok: false,
        reason: `Command ${parsedCommand.commandName} is disabled`,
      };
    }

    if (!isSpeakerAllowed(speaker, guildConfig)) {
      return {
        ok: false,
        reason: "Speaker is not authorized",
      };
    }

    const speakerChannel = speaker.voice.channel;
    if (!speakerChannel) {
      return {
        ok: false,
        reason: "Speaker is not in a voice channel",
      };
    }

    if (!botMember) {
      return {
        ok: false,
        reason: "Bot member is unavailable",
      };
    }

    const targetResolution = this.targetResolver.resolveTarget(
      guild,
      speaker,
      parsedCommand.commandName,
      parsedCommand.targetPhrase,
      botMember.id,
    );
    if (!targetResolution.ok) {
      return targetResolution;
    }

    const target = targetResolution.target;

    if (target.id === guild.ownerId) {
      return {
        ok: false,
        reason: "Guild owner cannot be moderated",
        targetUserId: target.id,
      };
    }

    if (!this.canModerate(botMember, target, guild.ownerId)) {
      return {
        ok: false,
        reason: "Bot role hierarchy is lower than target user",
        targetUserId: target.id,
      };
    }

    if (!this.canModerate(speaker, target, guild.ownerId)) {
      return {
        ok: false,
        reason: "Speaker role hierarchy is lower than target user",
        targetUserId: target.id,
      };
    }

    if (
      parsedCommand.commandName !== "drag" &&
      target.voice.channelId !== speakerChannel.id
    ) {
      return {
        ok: false,
        reason: "Target user is not in the same voice channel as speaker",
        targetUserId: target.id,
      };
    }

    if (parsedCommand.commandName === "drag") {
      if (!target.voice.channelId) {
        return {
          ok: false,
          reason: "Target user is not connected to voice",
          targetUserId: target.id,
        };
      }

      if (target.voice.channelId === speakerChannel.id) {
        return {
          ok: false,
          reason: "Target user is already in the speaker voice channel",
          targetUserId: target.id,
        };
      }
    }

    if (parsedCommand.commandName === "mute" && target.voice.serverMute) {
      return {
        ok: false,
        reason: "Target user is already muted",
        targetUserId: target.id,
      };
    }

    if (parsedCommand.commandName === "unmute" && !target.voice.serverMute) {
      return {
        ok: false,
        reason: "Target user is not currently muted",
        targetUserId: target.id,
      };
    }

    if (parsedCommand.commandName === "disconnect" && !target.voice.channelId) {
      return {
        ok: false,
        reason: "Target user is not connected to voice",
        targetUserId: target.id,
      };
    }

    return {
      ok: true,
      target,
    };
  }

  private canModerate(actor: GuildMember, target: GuildMember, guildOwnerId: string): boolean {
    if (actor.id === guildOwnerId) {
      return true;
    }

    return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
  }
}
