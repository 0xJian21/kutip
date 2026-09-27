# Kutip worker. Build from the repo root, for linux/amd64 (the Yellowstone gRPC client ships no linux-arm64 binary):
#   docker build --platform linux/amd64 -f apps/worker/Dockerfile -t kutip-worker .
#   docker run --env-file .env -p 8080:8080 kutip-worker        # health: GET /health
FROM node:22-slim
WORKDIR /app
# The native gRPC client verifies Solami's TLS against the OS trust store, which slim images lack.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/agent/package.json packages/agent/
COPY packages/solana/package.json packages/solana/
RUN pnpm install --frozen-lockfile --filter "@kutip/worker..."
COPY packages/db packages/db
COPY packages/agent packages/agent
COPY packages/solana packages/solana
COPY apps/worker/src apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "--import", "tsx", "apps/worker/src/index.ts"]
