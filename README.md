# NOVA

NOVA is a production-grade Discord voice moderation bot built with Node.js, TypeScript, Discord voice receive, Groq Whisper transcription, and Prisma on PostgreSQL.

## Features

- Deterministic command parsing for `drag`, `mute`, `unmute`, and `disconnect`
- Conservative fuzzy matching for command keywords only
- Strict validation for speaker eligibility, target resolution, role hierarchy, and command enablement
- FIFO moderation queue with single retry for Discord API failures
- Guild configuration loading from PostgreSQL with optional REST API primary source
- Structured JSON logging with command audit persistence
- Voice receive pipeline using `@discordjs/voice`, `prism-media`, and `opusscript`

## Runtime assumptions

- `drag <user>` moves the target into the speaker's current voice channel.
- `drag` resolves a target anywhere in the guild's active voice states.
- `mute`, `unmute`, and `disconnect` resolve targets only inside the speaker's current voice channel.
- `listen_mode=AUTO` causes NOVA to follow eligible speakers into voice channels automatically.
- `listen_mode=MANUAL` is preserved in configuration, but this scaffold does not yet expose a separate control surface for manual joins.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and provide real secrets:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Validate the Prisma schema:

```bash
npm run prisma:validate
```

5. Start development mode:

```bash
npm run dev
```

## Environment variables

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `GROQ_API_KEY`
- `DATABASE_URL`
- `CONFIG_API_URL` optional; if present, NOVA uses it as the primary config source and falls back to PostgreSQL

## Deployment

- Runtime: Node.js 20+
- Database: Railway PostgreSQL
- Build command: `npm install && npm run prisma:generate && npm run build`
- Start command: `npm start`

## Discord requirements

- Scopes: `bot`, `applications.commands`
- Intents: `Guilds`, `GuildVoiceStates`, `GuildMembers`
- Bot role must remain higher than any member NOVA moderates
