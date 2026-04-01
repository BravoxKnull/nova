import { Client, GatewayIntentBits } from "discord.js";
import { generateDependencyReport } from "@discordjs/voice";
import { ApiGuildConfigProvider } from "./config/apiGuildConfigProvider";
import { CachedGuildConfigService } from "./config/cachedGuildConfigService";
import { loadEnv } from "./config/env";
import { createPrismaClient } from "./database/prisma";
import { DatabaseGuildConfigRepository } from "./database/guildConfigRepository";
import { createLogger } from "./logger/createLogger";
import { DeterministicCommandParser } from "./parser/deterministicCommandParser";
import { SequentialExecutionQueue } from "./queue/sequentialExecutionQueue";
import { CommandAuditService } from "./database/commandAuditService";
import { TargetResolver } from "./validator/targetResolver";
import { CommandValidator } from "./validator/commandValidator";
import { ModerationExecutor } from "./executor/moderationExecutor";
import { VoiceCommandPipeline } from "./app/voiceCommandPipeline";
import { GroqTranscriptionService } from "./transcription/groqTranscriptionService";
import { VoiceSessionManager } from "./voice/voiceSessionManager";
import { VoiceAutoJoinCoordinator } from "./voice/voiceAutoJoinCoordinator";

function formatUnknownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
              stack: error.cause.stack,
            }
          : error.cause,
    };
  }

  return {
    value: error,
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();
  const prisma = createPrismaClient(env.databaseUrl);
  const databaseProvider = new DatabaseGuildConfigRepository(prisma);
  const primaryProvider = env.configApiUrl
    ? new ApiGuildConfigProvider(env.configApiUrl, logger)
    : databaseProvider;
  const configService = new CachedGuildConfigService(primaryProvider, databaseProvider, logger);
  const auditService = new CommandAuditService(databaseProvider, logger);
  const parser = new DeterministicCommandParser();
  const validator = new CommandValidator(new TargetResolver());
  const executor = new ModerationExecutor();
  const executionQueue = new SequentialExecutionQueue();
  const pipeline = new VoiceCommandPipeline(
    parser,
    validator,
    executor,
    auditService,
    executionQueue,
    logger,
  );
  const transcriptionService = new GroqTranscriptionService(env.groqApiKey, logger);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  const voiceSessionManager = new VoiceSessionManager(
    logger,
    configService,
    transcriptionService,
    pipeline,
  );
  const autoJoinCoordinator = new VoiceAutoJoinCoordinator(
    client,
    logger,
    configService,
    voiceSessionManager,
  );
  autoJoinCoordinator.start();

  client.once("ready", () => {
    logger.info(
      {
        botUserId: client.user?.id,
        dependencyReport: generateDependencyReport(),
      },
      "NOVA is ready",
    );
  });

  client.on("error", (error) => {
    logger.error({ error: formatUnknownError(error) }, "Discord client error");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ error: formatUnknownError(reason) }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ error: formatUnknownError(error) }, "Uncaught exception");
  });

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down NOVA");
    voiceSessionManager.destroyAll();
    client.destroy();
    await prisma.$disconnect();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  await client.login(env.discordToken);
}

void main().catch((error) => {
  const logger = createLogger();
  logger.fatal({ error: formatUnknownError(error) }, "Failed to start NOVA");
  process.exitCode = 1;
});
