# ── Stage 1: Dependencies ──
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# ── Stage 3: Production ──
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install openssl + Python with scientific packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    python3-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create workspace directory structure
RUN mkdir -p /var/www/atlas-workspace/{hypotheses,strategies,shared,data,alt-data,tools,scorecards,reports,research,post-mortems,sandbox,shared/mql5-templates} \
    && chown -R nextjs:nodejs /var/www/atlas-workspace

# Set up Python virtual environment
RUN python3 -m venv /var/www/atlas-workspace/.venv \
    && /var/www/atlas-workspace/.venv/bin/pip install --no-cache-dir \
    numpy pandas scipy statsmodels matplotlib seaborn scikit-learn requests beautifulsoup4 \
    && chown -R nextjs:nodejs /var/www/atlas-workspace/.venv

# Create initial state document
COPY --chown=nextjs:nodejs workspace-init/state.md /var/www/atlas-workspace/state.md

ENV WORKSPACE_PATH=/var/www/atlas-workspace
ENV PYTHON_VENV=/var/www/atlas-workspace/.venv/bin/python3

COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
