import type { BaseGuildVoiceChannel, Guild } from "discord.js";
import type { Logger } from "pino";
import type { CachedGuildConfigService } from "../config/cachedGuildConfigService";
import { VoiceCommandPipeline } from "../app/voiceCommandPipeline";
import { GroqTranscriptionService } from "../transcription/groqTranscriptionService";
import { GuildVoiceSession } from "./guildVoiceSession";

export class VoiceSessionManager {
  private readonly sessions = new Map<string, GuildVoiceSession>();

  public constructor(
    private readonly logger: Logger,
    private readonly configService: CachedGuildConfigService,
    private readonly transcriptionService: GroqTranscriptionService,
    private readonly pipeline: VoiceCommandPipeline,
  ) {}

  public getCurrentChannelId(guildId: string): string | null {
    return this.sessions.get(guildId)?.currentChannelId ?? null;
  }

  public async connect(guild: Guild, channel: BaseGuildVoiceChannel): Promise<void> {
    let session = this.sessions.get(guild.id);
    if (!session) {
      session = new GuildVoiceSession(
        guild,
        this.logger,
        this.configService,
        this.transcriptionService,
        this.pipeline,
      );
      this.sessions.set(guild.id, session);
    }

    await session.connect(channel);
  }

  public disconnect(guildId: string): void {
    this.sessions.get(guildId)?.disconnect();
    this.sessions.delete(guildId);
  }

  public destroyAll(): void {
    for (const [guildId, session] of this.sessions.entries()) {
      session.disconnect();
      this.sessions.delete(guildId);
    }
  }
}
