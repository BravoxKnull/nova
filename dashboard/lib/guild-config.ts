import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "./database";

export const DASHBOARD_COMMANDS = ["drag", "mute", "unmute", "disconnect"] as const;
export type DashboardCommandName = (typeof DASHBOARD_COMMANDS)[number];
export type DashboardListenMode = "AUTO" | "MANUAL";
export type DashboardAllowedSpeakerType = "USER" | "ROLE";

interface SettingsRow {
  listen_mode: DashboardListenMode;
}

interface CommandRow {
  command_name: "DRAG" | "MUTE" | "UNMUTE" | "DISCONNECT";
  enabled: boolean;
}

interface AliasRow {
  id: string;
  alias: string;
  command_name: "DRAG" | "MUTE" | "UNMUTE" | "DISCONNECT";
}

interface AllowedSpeakerRow {
  id: string;
  type: DashboardAllowedSpeakerType;
  discord_user_id: string | null;
  discord_role_id: string | null;
}

interface LogRow {
  id: string;
  speaker_id: string;
  raw_text: string;
  parsed_command: string | null;
  success: boolean;
  error_message: string | null;
  created_at: Date;
}

export interface DashboardCommandConfig {
  commandName: DashboardCommandName;
  enabled: boolean;
}

export interface DashboardAliasConfig {
  id: string;
  alias: string;
  commandName: DashboardCommandName;
}

export interface DashboardAllowedSpeakerConfig {
  id: string;
  type: DashboardAllowedSpeakerType;
  value: string;
}

export interface DashboardLogEntry {
  id: string;
  speakerId: string;
  rawText: string;
  parsedCommand: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

export interface GuildDashboardConfig {
  guildId: string;
  listenMode: DashboardListenMode;
  commands: DashboardCommandConfig[];
  aliases: DashboardAliasConfig[];
  allowedSpeakers: DashboardAllowedSpeakerConfig[];
  recentLogs: DashboardLogEntry[];
}

const COMMAND_TO_DB: Record<DashboardCommandName, CommandRow["command_name"]> = {
  drag: "DRAG",
  mute: "MUTE",
  unmute: "UNMUTE",
  disconnect: "DISCONNECT",
};

const COMMAND_FROM_DB: Record<CommandRow["command_name"], DashboardCommandName> = {
  DRAG: "drag",
  MUTE: "mute",
  UNMUTE: "unmute",
  DISCONNECT: "disconnect",
};

function normalizeAliasInput(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDiscordId(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{5,}$/.test(trimmed)) {
    throw new Error("Discord IDs must contain only digits");
  }

  return trimmed;
}

async function ensureGuildDefaults(client: PoolClient, guildId: string): Promise<void> {
  await client.query(
    `
      INSERT INTO guilds (id, guild_id, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (guild_id)
      DO UPDATE SET updated_at = NOW()
    `,
    [randomUUID(), guildId],
  );

  await client.query(
    `
      INSERT INTO guild_settings (id, guild_id, listen_mode, created_at, updated_at)
      VALUES ($1, $2, 'AUTO', NOW(), NOW())
      ON CONFLICT (guild_id) DO NOTHING
    `,
    [randomUUID(), guildId],
  );

  for (const commandName of DASHBOARD_COMMANDS) {
    await client.query(
      `
        INSERT INTO commands (id, guild_id, command_name, enabled)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (guild_id, command_name) DO NOTHING
      `,
      [randomUUID(), guildId, COMMAND_TO_DB[commandName]],
    );
  }
}

export async function getOrCreateGuildDashboardConfig(guildId: string): Promise<GuildDashboardConfig> {
  return withTransaction(async (client) => {
    await ensureGuildDefaults(client, guildId);

    const settingsResult = await client.query<SettingsRow>(
      "SELECT listen_mode FROM guild_settings WHERE guild_id = $1 LIMIT 1",
      [guildId],
    );
    const commandsResult = await client.query<CommandRow>(
      "SELECT command_name, enabled FROM commands WHERE guild_id = $1 ORDER BY command_name ASC",
      [guildId],
    );
    const aliasesResult = await client.query<AliasRow>(
      "SELECT id, alias, command_name FROM aliases WHERE guild_id = $1 ORDER BY alias ASC",
      [guildId],
    );
    const allowedSpeakersResult = await client.query<AllowedSpeakerRow>(
      `
        SELECT id, type, discord_user_id, discord_role_id
        FROM allowed_speakers
        WHERE guild_id = $1
        ORDER BY type ASC, COALESCE(discord_user_id, discord_role_id) ASC
      `,
      [guildId],
    );
    const logsResult = await client.query<LogRow>(
      `
        SELECT id, speaker_id, raw_text, parsed_command, success, error_message, created_at
        FROM logs
        WHERE guild_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `,
      [guildId],
    );

    const commandMap = new Map<DashboardCommandName, boolean>(
      commandsResult.rows.map((row) => [COMMAND_FROM_DB[row.command_name], row.enabled]),
    );

    return {
      guildId,
      listenMode: settingsResult.rows[0]?.listen_mode ?? "AUTO",
      commands: DASHBOARD_COMMANDS.map((commandName) => ({
        commandName,
        enabled: commandMap.get(commandName) ?? true,
      })),
      aliases: aliasesResult.rows.map((row) => ({
        id: row.id,
        alias: row.alias,
        commandName: COMMAND_FROM_DB[row.command_name],
      })),
      allowedSpeakers: allowedSpeakersResult.rows.map((row) => ({
        id: row.id,
        type: row.type,
        value: row.discord_user_id ?? row.discord_role_id ?? "",
      })),
      recentLogs: logsResult.rows.map((row) => ({
        id: row.id,
        speakerId: row.speaker_id,
        rawText: row.raw_text,
        parsedCommand: row.parsed_command,
        success: row.success,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
    };
  });
}

export async function updateGuildListenMode(
  guildId: string,
  listenMode: DashboardListenMode,
): Promise<void> {
  await withTransaction(async (client) => {
    await ensureGuildDefaults(client, guildId);
    await client.query(
      `
        UPDATE guild_settings
        SET listen_mode = $2, updated_at = NOW()
        WHERE guild_id = $1
      `,
      [guildId, listenMode],
    );
  });
}

export async function updateCommandEnabled(
  guildId: string,
  commandName: DashboardCommandName,
  enabled: boolean,
): Promise<void> {
  await withTransaction(async (client) => {
    await ensureGuildDefaults(client, guildId);
    await client.query(
      `
        UPDATE commands
        SET enabled = $3
        WHERE guild_id = $1 AND command_name = $2
      `,
      [guildId, COMMAND_TO_DB[commandName], enabled],
    );
  });
}

export async function createAlias(
  guildId: string,
  aliasInput: string,
  commandName: DashboardCommandName,
): Promise<void> {
  const alias = normalizeAliasInput(aliasInput);
  if (!alias || alias.includes(" ")) {
    throw new Error("Aliases must be a single normalized word");
  }

  if (DASHBOARD_COMMANDS.includes(alias as DashboardCommandName)) {
    throw new Error("Alias cannot overwrite a built-in command keyword");
  }

  await withTransaction(async (client) => {
    await ensureGuildDefaults(client, guildId);
    await client.query(
      `
        INSERT INTO aliases (id, guild_id, alias, command_name)
        VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), guildId, alias, COMMAND_TO_DB[commandName]],
    );
  });
}

export async function deleteAlias(guildId: string, aliasId: string): Promise<void> {
  await query("DELETE FROM aliases WHERE guild_id = $1 AND id = $2", [guildId, aliasId]);
}

export async function createAllowedSpeaker(
  guildId: string,
  type: DashboardAllowedSpeakerType,
  rawValue: string,
): Promise<void> {
  const normalizedValue = normalizeDiscordId(rawValue);

  await withTransaction(async (client) => {
    await ensureGuildDefaults(client, guildId);
    await client.query(
      `
        INSERT INTO allowed_speakers (id, guild_id, discord_user_id, discord_role_id, type)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        randomUUID(),
        guildId,
        type === "USER" ? normalizedValue : null,
        type === "ROLE" ? normalizedValue : null,
        type,
      ],
    );
  });
}

export async function deleteAllowedSpeaker(guildId: string, allowedSpeakerId: string): Promise<void> {
  await query("DELETE FROM allowed_speakers WHERE guild_id = $1 AND id = $2", [
    guildId,
    allowedSpeakerId,
  ]);
}
