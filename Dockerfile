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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# pdfkit loads its AFM font files via runtime require.resolve() which
# Next.js's output tracer cannot see statically. Without these bytes
# the PDF export route silently produces a malformed file that Adobe
# Acrobat rejects. Copy the pdfkit data + js directories explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfkit/js/data ./node_modules/pdfkit/js/data
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfkit/js/data ./.next/standalone/node_modules/pdfkit/js/data

# Defensive: ensure public assets are world-readable regardless of host perms.
RUN chmod -R a+rX ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
