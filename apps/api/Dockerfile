# Build from the repository root. Migrations by hand in the container: pnpm db:migrate
FROM node:24-slim
RUN npm i -g pnpm@10.28.2
WORKDIR /repo
COPY . .
RUN pnpm install && pnpm --filter @fingbo/api build
WORKDIR /repo/apps/api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
CMD ["pnpm", "start"]
