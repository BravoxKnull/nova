import type { Logger } from "pino";
import type { GuildRuntimeConfig } from "../types/moderation";
import type { GuildConfigProvider } from "./guildConfigProvider";

interface CacheEntry {
  expiresAt: number;
  value: GuildRuntimeConfig;
}

export class CachedGuildConfigService implements GuildConfigProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<GuildRuntimeConfig>>();

  public constructor(
    private readonly primaryProvider: GuildConfigProvider,
    private readonly fallbackProvider: GuildConfigProvider,
    private readonly logger: Logger,
    private readonly ttlMs = 15_000,
  ) {}

  public async getGuildRuntimeConfig(guildId: string): Promise<GuildRuntimeConfig> {
    const cached = this.cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const existingRequest = this.inFlight.get(guildId);
    if (existingRequest) {
      return existingRequest;
    }

    const request = this.loadConfig(guildId);
    this.inFlight.set(guildId, request);

    try {
      const config = await request;
      this.cache.set(guildId, {
        expiresAt: Date.now() + this.ttlMs,
        value: config,
      });
      return config;
    } finally {
      this.inFlight.delete(guildId);
    }
  }

  public invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  private async loadConfig(guildId: string): Promise<GuildRuntimeConfig> {
    try {
      return await this.primaryProvider.getGuildRuntimeConfig(guildId);
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          guildId,
        },
        "Primary config provider failed; falling back to database",
      );

      return this.fallbackProvider.getGuildRuntimeConfig(guildId);
    }
  }
}
