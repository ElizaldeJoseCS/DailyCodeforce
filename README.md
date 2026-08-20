# DailyCodeforce

Daily Codeforces problems for competitive programming practice. A new problem every day across four difficulty tiers, with LeetCode-style editorials.

**Live:** http://159.65.226.241

## Features

- **4 daily problems** — Beginner (800–1200), Intermediate (1200–1600), Advanced (1600–2000), Expert (2000+)
- **AI editorials** — LeetCode-style solutions with intuition, approach, complexity analysis, and C++ code via GPT-4o
- **Answer tab** — Editorials hidden until clicked, so you can attempt the problem first
- **Problem archive** — Browse past daily problems, 30-day backfill
- **Leaderboard** — Track progress and compete with others
- **Discord bot** — Same functionality via slash commands (`/daily`, `/stats`, `/solve`, `/leaderboard`)
- **90-day dedup** — Problems don't repeat within a rolling window

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | PostgreSQL (via Docker) |
| ORM | Prisma 7 with driver adapter |
| Editorials | OpenAI GPT-4o |
| Discord Bot | Go + DiscordGo |
| Deployment | Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Go 1.23+ (for Discord bot)

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

### Generate Editorials

```bash
# Add your OpenAI API key to web/.env
OPENAI_API_KEY="sk-..."

# Generate editorials for today's problems
cd web && npx tsx scripts/generate-editorials.ts --today

# Generate for all problems missing editorials
npx tsx scripts/generate-editorials.ts

# Clear and regenerate
npx tsx scripts/generate-editorials.ts --clear --today
```

### Deploy with Docker

```bash
cp .env.example .env
# Fill in .env with your values
docker compose up -d --build

# Push schema changes
docker run --rm --network dailycodeforce_default \
  -e DATABASE_URL="postgresql://dailycodeforce:YOUR_PASSWORD@postgres:5432/dailycodeforce?schema=public" \
  node:20-alpine sh -c "npm init -y && npm install prisma && npx prisma db push"
```

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | Site URL (e.g., `http://159.65.226.241`) |
| `OPENAI_API_KEY` | OpenAI API key for editorials |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `GUILD_ID` / `NOTIFICATION_CHANNEL_ID` | Discord bot config |
| `ADMIN_SECRET` | Secret for admin sync endpoint |

## Project Structure

```
dailycodeforce/
├── web/                        # Next.js app
│   ├── src/app/                # Pages and API routes
│   │   ├── api/daily/          # GET today's problems
│   │   ├── api/leaderboard/    # GET rankings
│   │   ├── api/progress/       # POST mark solved
│   │   ├── archive/            # Past problems
│   │   ├── leaderboard/        # Rankings page
│   │   └── problem/[id]/       # Problem detail + editorial
│   ├── src/components/         # React components
│   ├── src/lib/                # Utilities, API clients, editorial gen
│   ├── prisma/                 # Database schema
│   └── scripts/                # Cron scripts
├── bot/                        # Go Discord bot
├── docker-compose.yml          # All services
└── nginx.conf                  # Reverse proxy
```

## Scripts

| Script | Description |
|--------|-------------|
| `fetch-problems.ts` | Fetch problems from Codeforces API and seed DB |
| `fetch-problems.ts backfill 30` | Seed 30 days of past problems |
| `generate-editorials.ts` | Generate AI editorials for problems |
| `generate-editorials.ts --today` | Only generate for today's problems |
| `generate-editorials.ts --clear` | Clear all editorials first |

## Cost

- **DigitalOcean 2GB droplet**: ~$12/mo
- **OpenAI GPT-4o** (4 editorials/day): ~$2/mo
- **Total**: ~$14/mo

## TODO

- [ ] Discord bot deployment (needs `GUILD_ID` + `NOTIFICATION_CHANNEL_ID`)
- [ ] Daily cron job for automatic problem rotation
- [ ] User accounts and progress tracking UI
- [ ] Custom domain + SSL
- [ ] Seed editorials for full 30-day archive
