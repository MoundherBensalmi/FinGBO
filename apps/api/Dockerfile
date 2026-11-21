# FinGBO API. Build from the repository root (the build needs the whole pnpm workspace):
#   docker build -f apps/api/Dockerfile -t fingbo-api .
# Every dependency (dev ones included) is installed, so the usual commands work from a
# terminal in the container (it opens in /repo/apps/api):
#   pnpm db:migrate
#   pnpm user:create --username <name>
# Migrations are NOT run on start.

FROM node:24-slim
RUN npm install -g pnpm@10.28.2
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @fingbo/api build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /repo/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(()=>process.exit(0),()=>process.exit(1))"
CMD ["node", "dist/index.mjs"]
