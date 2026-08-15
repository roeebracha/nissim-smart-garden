# Node base image, install package.json deps, build TS, run dist/main.js.

# --- build stage: needs devDependencies (typescript, @nestjs/cli, prisma CLI) ---
FROM node:24-slim AS build
WORKDIR /app
# Prisma's query engine links against OpenSSL - the slim base image doesn't
# include it by default, so `prisma generate` can't detect it (falls back to
# a guess). Same install needed in the runtime stage below - that's the one
# that actually matters, since that's where the engine runs for real.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
# `prisma generate` only needs DATABASE_URL to be *set*, not connectable -
# it doesn't talk to a real DB at generate time. The real value is injected
# at container start via docker-compose's `environment:`, not baked in here.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
# Needs to run inside this (linux) container, not just copy what's on the
# host - the "classic" query engine binary is platform-specific.
RUN npx prisma generate
RUN npm run build

# --- runtime stage: only production deps + compiled output, no source/devDeps ---
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated

CMD ["node", "dist/src/main.js"]
