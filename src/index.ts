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
    logger.error({ err: error }, "Discord client error");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
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
  logger.fatal({ err: error }, "Failed to start NOVA");
  process.exitCode = 1;
});
