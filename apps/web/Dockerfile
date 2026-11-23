# Build from the repository root. VITE_API_URL (and optional VITE_API_URL_LOCAL, used on *.local) are read
# at build time: from Build-time Arguments (Dokploy), or from apps/web/.env.docker when
# VITE_MODE=docker (docker-compose.yml). Arguments win over the file.
FROM node:24-slim
RUN npm i -g pnpm@10.28.2
WORKDIR /repo
COPY . .
ARG VITE_API_URL
ARG VITE_API_URL_LOCAL
ARG VITE_MODE=production
RUN pnpm install && pnpm --filter @fingbo/web build --mode $VITE_MODE
WORKDIR /repo/apps/web
CMD ["pnpm", "start"]
