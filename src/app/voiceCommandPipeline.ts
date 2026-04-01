import type { Guild, GuildMember } from "discord.js";
import type { Logger } from "pino";
import { normalizeText } from "../normalization/normalizeText";
import { DeterministicCommandParser } from "../parser/deterministicCommandParser";
import { SequentialExecutionQueue } from "../queue/sequentialExecutionQueue";
import type { GuildRuntimeConfig } from "../types/moderation";
import { CommandAuditService } from "../database/commandAuditService";
import { ModerationExecutor } from "../executor/moderationExecutor";
import { CommandValidator } from "../validator/commandValidator";

export class VoiceCommandPipeline {
  public constructor(
    private readonly parser: DeterministicCommandParser,
    private readonly validator: CommandValidator,
    private readonly executor: ModerationExecutor,
    private readonly auditService: CommandAuditService,
    private readonly executionQueue: SequentialExecutionQueue,
    private readonly logger: Logger,
  ) {}

  public async processTranscription(params: {
    guild: Guild;
    speaker: GuildMember;
    rawText: string;
    guildConfig: GuildRuntimeConfig;
    receivedAt: number;
  }): Promise<void> {
    const { guild, speaker, rawText, guildConfig, receivedAt } = params;
    const normalizedText = normalizeText(rawText);

    if (!normalizedText) {
      return;
    }

    const catalog = this.parser.buildCatalog(guildConfig);
    const parsedCommand = this.parser.parse(normalizedText, catalog);
    if (!parsedCommand) {
      this.logger.debug(
        {
          guildId: guild.id,
          speakerId: speaker.id,
          rawText,
          normalizedText,
        },
        "Ignoring transcription that did not match deterministic grammar",
      );
      return;
    }

    const validation = this.validator.validate({
      guild,
      speaker,
      parsedCommand,
      guildConfig,
      botMember: guild.members.me,
    });

    if (!validation.ok) {
      await this.auditService.record({
        guildId: guild.id,
        channelId: speaker.voice.channelId,
        speakerId: speaker.id,
        rawText,
        normalizedText,
        parsedCommand: parsedCommand.commandName,
        targetUserId: validation.targetUserId ?? null,
        success: false,
        errorMessage: validation.reason,
        latencyMs: Date.now() - receivedAt,
      });
      return;
    }

    try {
      await this.executionQueue.enqueue(async () => {
        await this.executor.execute({
          commandName: parsedCommand.commandName,
          speaker,
          target: validation.target,
        });
      });

      await this.auditService.record({
        guildId: guild.id,
        channelId: speaker.voice.channelId,
        speakerId: speaker.id,
        rawText,
        normalizedText,
        parsedCommand: parsedCommand.commandName,
        targetUserId: validation.target.id,
        success: true,
        errorMessage: null,
        latencyMs: Date.now() - receivedAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown execution error";

      await this.auditService.record({
        guildId: guild.id,
        channelId: speaker.voice.channelId,
        speakerId: speaker.id,
        rawText,
        normalizedText,
        parsedCommand: parsedCommand.commandName,
        targetUserId: validation.target.id,
        success: false,
        errorMessage,
        latencyMs: Date.now() - receivedAt,
      });
    }
  }
}
