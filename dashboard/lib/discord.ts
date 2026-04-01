import { getDashboardEnv } from "./env";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const OAUTH_SCOPES = ["identify", "guilds"];
const INSTALL_SCOPES = ["bot", "applications.commands"];
const MANAGE_GUILD_PERMISSION = BigInt(0x20);

export interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

function readBotToken(): string | null {
  const dashboardEnv = getDashboardEnv();
  if (!dashboardEnv.discordBotToken) {
    return null;
  }

  return dashboardEnv.discordBotToken;
}

function buildOAuthUrl(
  scopes: readonly string[],
  state: string,
  guildId?: string,
): string {
  const dashboardEnv = getDashboardEnv();
  const url = new URL(`${DISCORD_API_BASE}/oauth2/authorize`);
  url.searchParams.set("client_id", dashboardEnv.discordClientId);
  url.searchParams.set("redirect_uri", dashboardEnv.discordRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);

  if (guildId) {
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
  }

  if (scopes.includes("bot")) {
    url.searchParams.set("permissions", dashboardEnv.botPermissions);
  }

  return url.toString();
}

async function discordRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export function buildDiscordLoginUrl(state: string): string {
  return buildOAuthUrl(OAUTH_SCOPES, state);
}

export function buildDiscordInstallUrl(guildId: string): string {
  const dashboardEnv = getDashboardEnv();
  const url = new URL(`${DISCORD_API_BASE}/oauth2/authorize`);
  url.searchParams.set("client_id", dashboardEnv.discordClientId);
  url.searchParams.set("scope", INSTALL_SCOPES.join(" "));
  url.searchParams.set("permissions", dashboardEnv.botPermissions);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const dashboardEnv = getDashboardEnv();
  const body = new URLSearchParams({
    client_id: dashboardEnv.discordClientId,
    client_secret: dashboardEnv.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: dashboardEnv.discordRedirectUri,
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} ${payload}`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const dashboardEnv = getDashboardEnv();
  const body = new URLSearchParams({
    client_id: dashboardEnv.discordClientId,
    client_secret: dashboardEnv.discordClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Discord token refresh failed: ${response.status} ${payload}`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  return discordRequest<DiscordUser>("/users/@me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuild[]> {
  return discordRequest<DiscordGuild[]>("/users/@me/guilds", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function isBotInstalledInGuild(guildId: string): Promise<boolean> {
  const botToken = readBotToken();
  if (!botToken) {
    return false;
  }

  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, {
    method: "GET",
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 403 || response.status === 404) {
    return false;
  }

  const body = await response.text();
  throw new Error(`Discord bot guild lookup failed: ${response.status} ${body}`);
}

export async function getInstalledBotGuildIds(guildIds: readonly string[]): Promise<Set<string>> {
  if (!readBotToken()) {
    return new Set();
  }

  const checks = await Promise.all(
    guildIds.map(async (guildId) => ({
      guildId,
      installed: await isBotInstalledInGuild(guildId),
    })),
  );

  return new Set(checks.filter((entry) => entry.installed).map((entry) => entry.guildId));
}

export function canManageGuild(guild: DiscordGuild): boolean {
  if (guild.owner) {
    return true;
  }

  return (BigInt(guild.permissions) & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
}

export function buildDiscordAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}
