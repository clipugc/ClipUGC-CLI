# Builds the ClipUGC MCP server (stdio) from source.
# Used by MCP directories such as Glama to start the server and list its tools.
# Run: docker build -t clipugc-mcp . && docker run -i --rm -e CLIPUGC_API_KEY=... clipugc-mcp
# Without CLIPUGC_API_KEY the server still starts and lists its tools; calls return an auth error.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
ENTRYPOINT ["node", "dist/index.js", "mcp"]
