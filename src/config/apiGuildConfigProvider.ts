import type { Logger } from "pino";
import { normalizeText } from "../normalization/normalizeText";
import type {
  AllowedSpeakerRule,
  CommandName,
  GuildRuntimeConfig,
  ListenMode,
} from "../types/moderation";
import type { GuildConfigProvider } from "./guildConfigProvider";

const COMMAND_NAMES = new Set<CommandName>(["drag", "mute", "unmute", "disconnect"]);
const LISTEN_MODES = new Set<ListenMode>(["AUTO", "MANUAL"]);

type ApiAllowedSpeaker = {
  type: "USER" | "ROLE";
  discordUserId?: unknown;
  discordRoleId?: unknown;
};

type ApiConfigResponse = {
  guildId?: unknown;
  listenMode?: unknown;
  enabledCommands?: unknown;
  aliases?: unknown;
  allowedSpeakers?: unknown;
};

export class ApiGuildConfigProvider implements GuildConfigProvider {
  public constructor(
    private readonly baseUrl: string,
    private readonly logger: Logger,
  ) {}

  public async getGuildRuntimeConfig(guildId: string): Promise<GuildRuntimeConfig> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/guilds/${guildId}/runtime-config`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Config API request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ApiConfigResponse;
    return this.parsePayload(guildId, payload);
  }

  private parsePayload(guildId: string, payload: ApiConfigResponse): GuildRuntimeConfig {
    const listenMode = this.parseListenMode(payload.listenMode);
    const enabledCommands = this.parseEnabledCommands(payload.enabledCommands);
    const aliases = this.parseAliases(payload.aliases);
    const allowedSpeakers = this.parseAllowedSpeakers(payload.allowedSpeakers);

    return {
      guildId,
      listenMode,
      enabledCommands,
      aliases,
      allowedSpeakers,
    };
  }

  private parseListenMode(value: unknown): ListenMode {
    if (typeof value === "string" && LISTEN_MODES.has(value as ListenMode)) {
      return value as ListenMode;
    }

    return "AUTO";
  }

  private parseEnabledCommands(value: unknown): ReadonlySet<CommandName> {
    if (!Array.isArray(value)) {
      return new Set<CommandName>();
    }

    const commands = new Set<CommandName>();
    for (const entry of value) {
      if (typeof entry === "string" && COMMAND_NAMES.has(entry as CommandName)) {
        commands.add(entry as CommandName);
      }
    }

    return commands;
  }

  private parseAliases(value: unknown): ReadonlyMap<string, CommandName> {
    const aliases = new Map<string, CommandName>();
    if (!Array.isArray(value)) {
      return aliases;
    }

    for (const entry of value) {
      const record = entry as Record<string, unknown>;
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof record.alias !== "string" ||
        typeof record.commandName !== "string"
      ) {
        continue;
      }

      const alias = normalizeText(record.alias);
      const commandName = record.commandName as CommandName;
      if (!alias || alias.includes(" ") || !COMMAND_NAMES.has(commandName)) {
        continue;
      }

      aliases.set(alias, commandName);
    }

    return aliases;
  }

  private parseAllowedSpeakers(value: unknown): readonly AllowedSpeakerRule[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const allowedSpeakers: AllowedSpeakerRule[] = [];
    for (const entry of value as ApiAllowedSpeaker[]) {
      const discordUserId =
        typeof entry.discordUserId === "string" && entry.discordUserId.length > 0
          ? entry.discordUserId
          : null;
      const discordRoleId =
        typeof entry.discordRoleId === "string" && entry.discordRoleId.length > 0
          ? entry.discordRoleId
          : null;

      if (entry.type === "USER" && discordUserId) {
        allowedSpeakers.push({
          type: "USER",
          discordUserId,
        });
      }

      if (entry.type === "ROLE" && discordRoleId) {
        allowedSpeakers.push({
          type: "ROLE",
          discordRoleId,
        });
      }
    }

    return allowedSpeakers;
  }
}
