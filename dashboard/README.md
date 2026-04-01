# NOVA Dashboard

The NOVA dashboard is a Next.js service that handles:

- Discord OAuth login
- guild discovery for the logged-in user
- NOVA bot install/invite links scoped to a selected guild
- the initial surface for future guild settings pages

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Required environment variables

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_BOT_PERMISSIONS`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Railway deployment

- Create a second Railway service from the same repository
- Set the service root directory to `dashboard`
- Build command: `npm install && npm run build`
- Start command: `npm start`
