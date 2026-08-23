FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=768"
COPY web/package*.json ./
COPY web/prisma ./prisma/
RUN npm ci
COPY web/ .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache g++ python3 make

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY judge/judge.py ./judge/judge.py
RUN chmod +x ./judge/judge.py

EXPOSE 3000
CMD ["node", "server.js"]
