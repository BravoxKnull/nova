-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ListenMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AllowedSpeakerType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "CommandName" AS ENUM ('DRAG', 'MUTE', 'UNMUTE', 'DISCONNECT');

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "listen_mode" "ListenMode" NOT NULL DEFAULT 'AUTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_speakers" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "discord_user_id" TEXT,
    "discord_role_id" TEXT,
    "type" "AllowedSpeakerType" NOT NULL,

    CONSTRAINT "allowed_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "command_name" "CommandName" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aliases" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "command_name" "CommandName" NOT NULL,

    CONSTRAINT "aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "speaker_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "parsed_command" TEXT,
    "target_user_id" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guilds_guild_id_key" ON "guilds"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "guild_settings_guild_id_key" ON "guild_settings"("guild_id");

-- CreateIndex
CREATE INDEX "allowed_speakers_guild_id_idx" ON "allowed_speakers"("guild_id");

-- CreateIndex
CREATE INDEX "commands_guild_id_enabled_idx" ON "commands"("guild_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "commands_guild_id_command_name_key" ON "commands"("guild_id", "command_name");

-- CreateIndex
CREATE INDEX "aliases_guild_id_idx" ON "aliases"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "aliases_guild_id_alias_key" ON "aliases"("guild_id", "alias");

-- CreateIndex
CREATE INDEX "logs_guild_id_created_at_idx" ON "logs"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "logs_speaker_id_created_at_idx" ON "logs"("speaker_id", "created_at");

-- AddForeignKey
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_speakers" ADD CONSTRAINT "allowed_speakers_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
