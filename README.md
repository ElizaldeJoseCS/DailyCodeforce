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
