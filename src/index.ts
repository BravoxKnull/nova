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
  logger.info("Startup checkpoint: environment loaded");
  const prisma = createPrismaClient(env.databaseUrl);
  logger.info("Startup checkpoint: prisma client created");
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
  logger.info("Startup checkpoint: command pipeline created");
  const transcriptionService = new GroqTranscriptionService(env.groqApiKey, logger);
  logger.info("Startup checkpoint: transcription service created");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
  logger.info("Startup checkpoint: discord client created");

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

  logger.info("Startup checkpoint: attempting Discord login");
  await client.login(env.discordToken);
}

void main().catch((error) => {
  const logger = createLogger();
  const formattedError = formatUnknownError(error);
  logger.fatal({ error: formattedError }, "Failed to start NOVA");
  console.error("NOVA_STARTUP_ERROR", JSON.stringify(formattedError));
  process.exitCode = 1;
});
