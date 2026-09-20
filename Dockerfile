# docker build -t discord-botlists .
# Pinned bun image: the SDK targets Bun (bun:test) and Node >= 18 runtimes.
FROM oven/bun:1

WORKDIR /app

# Dependencies first for layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY test ./test

CMD ["bun", "test"]
