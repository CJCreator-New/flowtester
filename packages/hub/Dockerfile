FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY packages/hub/package.json packages/hub/
RUN pnpm install --frozen-lockfile

COPY packages/types packages/types
COPY packages/hub packages/hub
RUN pnpm --filter @qa/types run build
RUN pnpm --filter @qa/hub run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/types/package.json /app/packages/types/package.json
COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/hub/package.json /app/packages/hub/package.json
COPY --from=builder /app/packages/hub/dist /app/packages/hub/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/hub/node_modules /app/packages/hub/node_modules

EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "packages/hub/dist/index.js"]
