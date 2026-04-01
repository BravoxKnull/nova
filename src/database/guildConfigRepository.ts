import {
  AllowedSpeakerType,
  CommandName as PrismaCommandName,
  ListenMode as PrismaListenMode,
  PrismaClient,
} from "@prisma/client";
import {
  type AllowedSpeakerRule,
  type CommandAuditRecord,
  type CommandName,
  type GuildRuntimeConfig,
  type ListenMode,
} from "../types/moderation";
import type { GuildConfigProvider } from "../config/guildConfigProvider";
import { normalizeText } from "../normalization/normalizeText";

const COMMAND_NAME_MAP: Record<PrismaCommandName, CommandName> = {
  DRAG: "drag",
  MUTE: "mute",
  UNMUTE: "unmute",
  DISCONNECT: "disconnect",
};

const LISTEN_MODE_MAP: Record<PrismaListenMode, ListenMode> = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
};

export class DatabaseGuildConfigRepository implements GuildConfigProvider {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getGuildRuntimeConfig(guildId: string): Promise<GuildRuntimeConfig> {
    const guild = await this.prisma.guild.findUnique({
      where: { guildId },
      include: {
        settings: true,
        allowedSpeakers: true,
        commands: true,
        aliases: true,
      },
    });

    if (!guild) {
      return this.buildDefaultConfig(guildId);
    }

    const enabledCommands = new Set<CommandName>();
    for (const command of guild.commands) {
      if (!command.enabled) {
        continue;
      }

      enabledCommands.add(COMMAND_NAME_MAP[command.commandName]);
    }

    const aliases = new Map<string, CommandName>();
    for (const alias of guild.aliases) {
      const normalizedAlias = normalizeText(alias.alias);
      if (!normalizedAlias || normalizedAlias.includes(" ")) {
        continue;
      }

      aliases.set(normalizedAlias, COMMAND_NAME_MAP[alias.commandName]);
    }

    return {
      guildId,
      listenMode: guild.settings ? LISTEN_MODE_MAP[guild.settings.listenMode] : "AUTO",
      allowedSpeakers: guild.allowedSpeakers.flatMap((allowedSpeaker) =>
        this.mapAllowedSpeakerRule(allowedSpeaker.type, allowedSpeaker.discordUserId, allowedSpeaker.discordRoleId),
      ),
      enabledCommands,
      aliases,
    };
  }

  public async createCommandLog(record: CommandAuditRecord): Promise<void> {
    await this.prisma.guild.upsert({
      where: {
        guildId: record.guildId,
      },
      create: {
        guildId: record.guildId,
      },
      update: {},
    });

    await this.prisma.commandLog.create({
      data: {
        guildId: record.guildId,
        speakerId: record.speakerId,
        rawText: record.rawText,
        normalizedText: record.normalizedText,
        parsedCommand: record.parsedCommand,
        targetUserId: record.targetUserId,
        success: record.success,
        errorMessage: record.errorMessage,
        latencyMs: record.latencyMs,
      },
    });
  }

  private buildDefaultConfig(guildId: string): GuildRuntimeConfig {
    return {
      guildId,
      listenMode: "AUTO",
      allowedSpeakers: [],
      enabledCommands: new Set<CommandName>(),
      aliases: new Map<string, CommandName>(),
    };
  }

  private mapAllowedSpeakerRule(
    type: AllowedSpeakerType,
    discordUserId: string | null,
    discordRoleId: string | null,
  ): AllowedSpeakerRule[] {
    if (type === "USER" && discordUserId) {
      return [
        {
          type: "USER",
          discordUserId,
        },
      ];
    }

    if (type === "ROLE" && discordRoleId) {
      return [
        {
          type: "ROLE",
          discordRoleId,
        },
      ];
    }

    return [];
  }
}
