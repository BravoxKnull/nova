type RequiredEnvKey =
  | "DISCORD_CLIENT_ID"
  | "DISCORD_CLIENT_SECRET"
  | "DISCORD_REDIRECT_URI"
  | "SESSION_SECRET"
  | "NEXT_PUBLIC_APP_URL";

function readEnv(name: RequiredEnvKey): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required dashboard environment variable: ${name}`);
  }

  return value;
}

export function getDashboardEnv() {
  return {
    discordClientId: readEnv("DISCORD_CLIENT_ID"),
    discordClientSecret: readEnv("DISCORD_CLIENT_SECRET"),
    discordRedirectUri: readEnv("DISCORD_REDIRECT_URI"),
    sessionSecret: readEnv("SESSION_SECRET"),
    appUrl: readEnv("NEXT_PUBLIC_APP_URL"),
    botPermissions: process.env.DISCORD_BOT_PERMISSIONS?.trim() || "4198400",
  };
}
