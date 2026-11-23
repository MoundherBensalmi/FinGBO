# Build from the repository root. VITE_API_URL (and optional VITE_API_URL_LOCAL, used on *.local) are read at build time (Dokploy: Build-time Arguments).
FROM node:24-slim
RUN npm i -g pnpm@10.28.2
WORKDIR /repo
COPY . .
ARG VITE_API_URL
ARG VITE_API_URL_LOCAL
RUN pnpm install && pnpm --filter @fingbo/web build
WORKDIR /repo/apps/web
CMD ["pnpm", "start"]
