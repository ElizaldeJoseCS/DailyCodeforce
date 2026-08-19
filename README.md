# DailyCodeforce

Daily Codeforces problems for competitive programming practice. A new problem every day across four difficulty tiers, with AI-generated algorithm visualizations.

## Features

- **4 daily problems** — Beginner (800–1200), Intermediate (1200–1600), Advanced (1600–2000), Expert (2000+)
- **AI-generated visuals** — Algorithm concept illustrations for each problem via OpenAI GPT Image
- **Problem archive** — Browse past daily problems, filter by tier
- **Leaderboard** — Track progress and compete with others
- **Discord bot** — Same functionality via slash commands (`/daily`, `/stats`, `/solve`, `/leaderboard`)
- **90-day dedup** — Problems don't repeat within a rolling window

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | PostgreSQL (via Docker) |
| ORM | Prisma 7 with driver adapter |
| Discord Bot | Go + DiscordGo |
| AI Visuals | OpenAI GPT Image 1 |
| Deployment | Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Node.js 20+
- Go 1.23+
- Docker + Docker Compose

### Local Development

```bash
# Start PostgreSQL
docker compose up -d postgres

# Install web dependencies
cd web && npm install

# Set up database
npx prisma db push

# Seed 30 days of problems
npx tsx scripts/fetch-problems.ts backfill 30

# Seed today's problems
npx tsx scripts/fetch-problems.ts

# Start dev server
npx next dev
```

Visit http://localhost:3000

### Generate AI Visuals

```bash
# Add your OpenAI API key to web/.env
OPENAI_API_KEY="sk-..."

# Generate visuals for problems missing them
cd web && npx tsx scripts/generate-visuals.ts
```

### Deploy with Docker

```bash
cp .env.example .env
# Fill in .env with your values
docker compose up -d
```

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `DISCORD_BOT_TOKEN` — Discord bot token
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — Discord OAuth
- `OPENAI_API_KEY` — For AI-generated visuals
- `GUILD_ID` / `NOTIFICATION_CHANNEL_ID` — Discord bot config

## Project Structure

```
dailycodeforce/
├── web/                    # Next.js app
│   ├── src/app/            # Pages and API routes
│   ├── src/lib/            # Utilities, API clients
│   ├── prisma/             # Database schema
│   └── scripts/            # Cron scripts (fetch problems, generate visuals)
├── bot/                    # Go Discord bot
├── docker-compose.yml      # All services
└── nginx.conf              # Reverse proxy
```
