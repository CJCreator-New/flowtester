# Wizard: a static site. The browser calls the runner directly, so VITE_RUNNER_URL is the runner's
# address as seen from the user's browser (not from inside Docker).
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/wizard/package.json packages/wizard/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN pnpm install --frozen-lockfile --filter "@qa/wizard..."

COPY packages/types packages/types
COPY packages/wizard packages/wizard
ARG VITE_RUNNER_URL=http://localhost:3001
ENV VITE_RUNNER_URL=${VITE_RUNNER_URL}
RUN pnpm --filter "@qa/wizard..." run build

FROM nginx:1.27-alpine
COPY packages/wizard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/wizard/dist /usr/share/nginx/html
EXPOSE 3002
