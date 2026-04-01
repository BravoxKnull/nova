import { config as loadDotEnv } from "dotenv";

loadDotEnv();

export interface AppEnv {
  discordToken: string;
  discordClientId: string;
  groqApiKey: string;
  databaseUrl: string;
  configApiUrl?: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadEnv(): AppEnv {
  const configApiUrl = process.env.CONFIG_API_URL?.trim();

  return {
    discordToken: readRequiredEnv("DISCORD_TOKEN"),
    discordClientId: readRequiredEnv("DISCORD_CLIENT_ID"),
    groqApiKey: readRequiredEnv("GROQ_API_KEY"),
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    ...(configApiUrl ? { configApiUrl } : {}),
  };
}
