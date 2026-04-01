# NOVA Dashboard

The NOVA dashboard is a Next.js service that handles:

- Discord OAuth login
- guild discovery for the logged-in user
- NOVA bot install/invite links scoped to a selected guild
- database-backed guild settings pages with safe default configuration

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Required environment variables

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN` recommended so the dashboard can verify whether NOVA is already installed in a guild
- `DISCORD_REDIRECT_URI`
- `DISCORD_BOT_PERMISSIONS`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`

## Railway deployment

- Create a second Railway service from the same repository
- Set the service root directory to `dashboard`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Attach the same Railway PostgreSQL database and expose its connection string as `DATABASE_URL`

## Default guild configuration

The first time a guild settings page is opened, the dashboard creates the default records NOVA needs:

- a `guilds` row
- a `guild_settings` row with `listen_mode=AUTO`
- all built-in commands enabled
- no aliases
- no allowed speakers until the guild owner adds them
