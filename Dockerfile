FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api-test.jana.earth
ARG NEXT_PUBLIC_AUTH_URL=https://auth-dev.jana.earth
ARG NEXT_PUBLIC_DEMO_USE_MOCKS=true

# Does this image contain the demo layer?
#
# "1" bakes in the 80,035-loan synthesizer, the PCAF name fixtures, the
# synthetic air-quality generator and the Demo menu. Anything else produces a
# live image: no synthesizer in the bundle, empty loan book, no demo controls.
#
# Defaults to 1 because this Dockerfile builds the demo. A customer image is
# produced by passing JANA_DEMO=0 explicitly -- and the difference is real, not
# cosmetic: the fabricated data is absent from the bundle, not merely hidden.
# See lib/demo/provider.ts.
ARG JANA_DEMO=1

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_DEMO_USE_MOCKS=$NEXT_PUBLIC_DEMO_USE_MOCKS
ENV JANA_DEMO=$JANA_DEMO
ENV NEXT_OUTPUT=standalone

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Carry the build-time demo decision into the runtime stage.
#
# isDemoBuild() reads process.env.JANA_DEMO in the running server, not just at
# compile time -- it gates the Demo menu, the /api/demo/mode toggle route and
# the provider's dynamic import. Without this line the image would contain the
# demo layer but refuse to serve it, and the failure would be silent: an empty
# loan book in an image built to be the demo, with no error anywhere saying
# why. Re-declared here because ARGs do not cross FROM boundaries.
ARG JANA_DEMO=1
ENV JANA_DEMO=$JANA_DEMO

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

# Health check: /api/health returns 200 when the Next.js server is ready.
# curl is included in node:20-alpine via busybox wget; use wget instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
