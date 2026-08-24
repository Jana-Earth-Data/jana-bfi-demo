FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api-test.jana.earth
ARG NEXT_PUBLIC_AUTH_URL=https://auth-dev.jana.earth
ARG NEXT_PUBLIC_DEMO_USE_MOCKS=true

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_DEMO_USE_MOCKS=$NEXT_PUBLIC_DEMO_USE_MOCKS
ENV NEXT_OUTPUT=standalone

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Next.js standalone server.js binds to process.env.HOSTNAME || '0.0.0.0'.
# Docker auto-sets HOSTNAME to the container ID, which is not always
# resolvable (getaddrinfo EAI_AGAIN -> "Failed to start server"). Pinning it
# to 0.0.0.0 makes the bind address independent of the container's name.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Defensive: ensure public assets are world-readable regardless of host perms.
RUN chmod -R a+rX ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
