# FinGBO API. Build from the repository root (the build needs the whole pnpm workspace):
#   docker build -f apps/api/Dockerfile -t fingbo-api .
# On start it applies the pending database migrations, then runs the API on port 3001.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @fingbo/api build
# Production dependencies of the API only, in a standalone folder
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @fingbo/api deploy --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(()=>process.exit(0),()=>process.exit(1))"
CMD ["sh", "-c", "node dist/migrate.mjs && exec node dist/index.mjs"]
