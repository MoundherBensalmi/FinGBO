# FinGBO web app. Build from the repository root (the build needs the whole pnpm workspace):
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t fingbo-web .
# VITE_API_URL is baked into the files at build time: changing it needs a rebuild.
# Serves the built app with nginx on port 80.

FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "Build argument VITE_API_URL is required" && exit 1)
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @fingbo/web build

FROM nginx:1.29-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
