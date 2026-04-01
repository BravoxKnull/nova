import type { Logger } from "pino";
import type { CommandAuditRecord } from "../types/moderation";
import { DatabaseGuildConfigRepository } from "./guildConfigRepository";

export class CommandAuditService {
  public constructor(
    private readonly repository: DatabaseGuildConfigRepository,
    private readonly logger: Logger,
  ) {}

  public async record(record: CommandAuditRecord): Promise<void> {
    this.logger.info(
      {
        event: "command_audit",
        guildId: record.guildId,
        channelId: record.channelId,
        speakerId: record.speakerId,
        rawText: record.rawText,
        normalizedText: record.normalizedText,
        parsedCommand: record.parsedCommand,
        targetUserId: record.targetUserId,
        success: record.success,
        latencyMs: record.latencyMs,
        errorMessage: record.errorMessage,
      },
      "Command execution audited",
    );

    try {
      await this.repository.createCommandLog(record);
    } catch (error) {
      this.logger.error(
        {
          err: error,
          guildId: record.guildId,
          speakerId: record.speakerId,
        },
        "Failed to persist command log",
      );
    }
  }
}
