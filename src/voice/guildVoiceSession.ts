import {
  EndBehaviorType,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import type { BaseGuildVoiceChannel, Guild, GuildMember } from "discord.js";
import type { Logger } from "pino";
import prism from "prism-media";
import type { CachedGuildConfigService } from "../config/cachedGuildConfigService";
import { VoiceCommandPipeline } from "../app/voiceCommandPipeline";
import { isSpeakerAllowed } from "../validator/speakerAuthorization";
import { Pcm16KhzMonoChunker } from "../transcription/pcm16KhzMonoChunker";
import { GroqTranscriptionService } from "../transcription/groqTranscriptionService";

interface SpeakerStreamContext {
  active: boolean;
}

export class GuildVoiceSession {
  private connection: VoiceConnection | null = null;
  private readonly activeSpeakerStreams = new Map<string, SpeakerStreamContext>();

  public constructor(
    private readonly guild: Guild,
    private readonly logger: Logger,
    private readonly configService: CachedGuildConfigService,
    private readonly transcriptionService: GroqTranscriptionService,
    private readonly pipeline: VoiceCommandPipeline,
  ) {}

  public get currentChannelId(): string | null {
    return this.connection?.joinConfig.channelId ?? null;
  }

  public async connect(channel: BaseGuildVoiceChannel): Promise<void> {
    if (this.currentChannelId === channel.id && this.connection) {
      return;
    }

    this.activeSpeakerStreams.clear();
    this.connection?.destroy();
    this.connection = joinVoiceChannel({
      adapterCreator: this.guild.voiceAdapterCreator,
      channelId: channel.id,
      guildId: this.guild.id,
      selfDeaf: false,
      selfMute: true,
    });

    this.registerConnectionLifecycle(this.connection);
    await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
    this.registerReceiver();

    this.logger.info(
      {
        guildId: this.guild.id,
        channelId: channel.id,
      },
      "Voice connection ready",
    );
  }

  public disconnect(): void {
    this.connection?.destroy();
    this.connection = null;
    this.activeSpeakerStreams.clear();
  }

  private registerConnectionLifecycle(connection: VoiceConnection): void {
    connection.on("stateChange", async (_, nextState) => {
      if (nextState.status !== VoiceConnectionStatus.Disconnected) {
        return;
      }

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.logger.warn({ guildId: this.guild.id }, "Voice connection dropped; destroying session");
        connection.destroy();
        if (this.connection === connection) {
          this.connection = null;
        }
      }
    });
  }

  private registerReceiver(): void {
    const connection = this.connection;
    if (!connection) {
      return;
    }

    connection.receiver.speaking.on("start", (userId) => {
      void this.handleSpeakerStart(userId);
    });
  }

  private async handleSpeakerStart(userId: string): Promise<void> {
    if (!this.connection || this.activeSpeakerStreams.has(userId)) {
      return;
    }

    const speaker = await this.fetchMember(userId);
    if (!speaker || speaker.user.bot) {
      return;
    }

    const guildConfig = await this.configService.getGuildRuntimeConfig(this.guild.id);
    if (!isSpeakerAllowed(speaker, guildConfig)) {
      return;
    }

    if (speaker.voice.channelId !== this.currentChannelId) {
      return;
    }

    const opusStream = this.connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 250,
      },
    });
    const decoder = new prism.opus.Decoder({
      channels: 2,
      frameSize: 960,
      rate: 48_000,
    });
    const chunker = new Pcm16KhzMonoChunker();

    this.activeSpeakerStreams.set(userId, { active: true });

    let transcriptionChain = Promise.resolve();
    const enqueueChunk = (chunk: Buffer): void => {
      const receivedAt = Date.now();
      transcriptionChain = transcriptionChain
        .then(async () => {
          const latestConfig = await this.configService.getGuildRuntimeConfig(this.guild.id);
          const rawText = await this.transcriptionService.transcribeChunk({
            pcm16Mono: chunk,
            guildConfig: latestConfig,
          });
          await this.pipeline.processTranscription({
            guild: this.guild,
            speaker,
            rawText,
            guildConfig: latestConfig,
            receivedAt,
          });
        })
        .catch((error) => {
          this.logger.error(
            {
              err: error,
              guildId: this.guild.id,
              speakerId: userId,
            },
            "Failed to process speaker chunk",
          );
        });
    };

    decoder.on("data", (pcmChunk: Buffer) => {
      for (const chunk of chunker.push(Buffer.from(pcmChunk))) {
        enqueueChunk(chunk);
      }
    });

    decoder.on("end", () => {
      const finalChunk = chunker.flush();
      if (finalChunk) {
        enqueueChunk(finalChunk);
      }

      void transcriptionChain.finally(() => {
        this.activeSpeakerStreams.delete(userId);
      });
    });

    decoder.on("error", (error) => {
      this.activeSpeakerStreams.delete(userId);
      this.logger.error(
        {
          err: error,
          guildId: this.guild.id,
          speakerId: userId,
        },
        "PCM decoder error",
      );
    });

    opusStream.on("error", (error) => {
      this.activeSpeakerStreams.delete(userId);
      this.logger.error(
        {
          err: error,
          guildId: this.guild.id,
          speakerId: userId,
        },
        "Opus receive stream error",
      );
    });

    opusStream.pipe(decoder);
  }

  private async fetchMember(userId: string): Promise<GuildMember | null> {
    const cachedMember = this.guild.members.cache.get(userId);
    if (cachedMember) {
      return cachedMember;
    }

    try {
      return await this.guild.members.fetch(userId);
    } catch {
      return null;
    }
  }
}
