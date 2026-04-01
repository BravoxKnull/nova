export const COMMAND_NAMES = ["drag", "mute", "unmute", "disconnect"] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];
export type ListenMode = "AUTO" | "MANUAL";

export type AllowedSpeakerRule =
  | {
      type: "USER";
      discordUserId: string;
    }
  | {
      type: "ROLE";
      discordRoleId: string;
    };

export interface GuildRuntimeConfig {
  guildId: string;
  listenMode: ListenMode;
  allowedSpeakers: readonly AllowedSpeakerRule[];
  enabledCommands: ReadonlySet<CommandName>;
  aliases: ReadonlyMap<string, CommandName>;
}

export interface ParsedCommand {
  commandName: CommandName;
  matchedKeyword: string;
  targetPhrase: string;
}

export interface CommandCandidate {
  keyword: string;
  commandName: CommandName;
  source: "canonical" | "alias";
}

export interface CommandAuditRecord {
  guildId: string;
  channelId: string | null;
  speakerId: string;
  rawText: string;
  normalizedText: string;
  parsedCommand: CommandName | null;
  targetUserId: string | null;
  success: boolean;
  errorMessage: string | null;
  latencyMs: number;
}
