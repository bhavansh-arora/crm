# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
# Alpine ships without openssl by default; Prisma's engine-detection needs it
# to pick the matching binary (openssl3, not the older 1.1.x it silently
# falls back to) — skipping this causes a "libssl.so.1.1 not found" crash at
# runtime that only shows up once the container is actually queried.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
# next-auth declares an optional peer on an older nodemailer than the one
# this project pins (we only use next-auth's Credentials provider, which
# doesn't touch nodemailer at all) — --legacy-peer-deps skips that check.
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apk add --no-cache openssl

# The `prisma` CLI (needed at startup to run `migrate deploy`) is not part
# of the standalone server trace, so it's installed separately here.
RUN npm install -g prisma@5

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Next's standalone trace inlines bcryptjs into the compiled route bundles
# rather than leaving it as a loose module, but prisma/seed.docker.cjs
# needs it as a real package at runtime — copy it explicitly.
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
# Created (and owned by the app user) before USER drops root, so the named
# volume mounted here at runtime inherits correct ownership on first use.
RUN mkdir -p ./uploads && chown nextjs:nodejs ./uploads

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
