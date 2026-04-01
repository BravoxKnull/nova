# NOVA

NOVA now includes two deployable services:

- the root Discord voice moderation bot
- the `dashboard` Discord OAuth website for login, guild discovery, and bot install flow

The bot is built with Node.js, TypeScript, Discord voice receive, Groq Whisper transcription, and Prisma on PostgreSQL. The dashboard is a Next.js app for Discord login and server onboarding.

## Features

- Deterministic command parsing for `drag`, `mute`, `unmute`, and `disconnect`
- Conservative fuzzy matching for command keywords only
- Strict validation for speaker eligibility, target resolution, role hierarchy, and command enablement
- FIFO moderation queue with single retry for Discord API failures
- Guild configuration loading from PostgreSQL with optional REST API primary source
- Structured JSON logging with command audit persistence
- Voice receive pipeline using `@discordjs/voice`, `prism-media`, and `opusscript`
- Discord OAuth dashboard with guild listing and install/invite flow

## Runtime assumptions

- `drag <user>` moves the target into the speaker's current voice channel.
- `drag` resolves a target anywhere in the guild's active voice states.
- `mute`, `unmute`, and `disconnect` resolve targets only inside the speaker's current voice channel.
- `listen_mode=AUTO` causes NOVA to follow eligible speakers into voice channels automatically.
- `listen_mode=MANUAL` is preserved in configuration, but this scaffold does not yet expose a separate control surface for manual joins.

## Setup

### Bot

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

### Dashboard

1. Install dashboard dependencies:

```bash
cd dashboard
npm install
```

2. Copy the dashboard env file:

```bash
cp .env.example .env.local
```

3. Start the dashboard:

```bash
npm run dev
```

## Environment variables

### Bot

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `GROQ_API_KEY`
- `DATABASE_URL`
- `CONFIG_API_URL` optional; if present, NOVA uses it as the primary config source and falls back to PostgreSQL

### Dashboard

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN` recommended so the dashboard can enforce "invite before config"
- `DISCORD_REDIRECT_URI`
- `DISCORD_BOT_PERMISSIONS`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`

## Deployment

### Railway Bot Service

- Root directory: repository root
- Runtime: Node.js 22+
- Database: Railway PostgreSQL
- Build command: `npm install && npm run prisma:generate && npm run build`
- Start command: `npm start`
- After the first PostgreSQL service is attached, apply the committed migration with:
  `npx prisma migrate deploy`

### Railway Dashboard Service

- Root directory: `dashboard`
- Runtime: Node.js 22+
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Attach the same Railway PostgreSQL service and set `DATABASE_URL`

## Database migration

The initial Prisma migration is committed under [prisma/migrations/20260401184000_init/migration.sql](D:\NOVA\prisma\migrations\20260401184000_init\migration.sql).

Apply it against Railway Postgres with the bot service environment:

```bash
npx prisma migrate deploy
```

If you run this locally against Railway, use the Railway `DATABASE_URL` in your shell first. After migrations are applied, the bot and future dashboard config pages will share the same schema.

## Discord requirements

- Scopes: `bot`, `applications.commands`
- Intents: `Guilds`, `GuildVoiceStates`, `GuildMembers`
- Bot role must remain higher than any member NOVA moderates
- In Discord Developer Portal, enable `Server Members Intent`
- For the dashboard OAuth flow, set the redirect URL to your deployed dashboard callback route:
  `https://your-dashboard-domain/api/auth/discord/callback`
