# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Vite inlines these at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_MCP_OAUTH_ISSUER
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_MCP_OAUTH_ISSUER=$VITE_MCP_OAUTH_ISSUER

COPY package.json package-lock.json* bun.lock* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Export the SDK-generated VM function from the same configured build.
FROM scratch AS mcp-artifacts
COPY --from=build /app/supabase/functions/mcp/index.ts /mcp/index.ts

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
