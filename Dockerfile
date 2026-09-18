# syntax=docker/dockerfile:1

# ---------- Build stage: compile the static PWA ----------
FROM node:24-alpine AS build
WORKDIR /app

# Install deps against the lockfile first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Ingredient icons are committed under public/icons/. Fallback: if they are ever
# missing from the build context, fetch them from Zelda Wiki.
RUN if [ -z "$(ls -A public/icons 2>/dev/null)" ]; then \
      apk add --no-cache python3 && python3 scripts/fetch-icons.py; \
    fi

RUN npm run build

# ---------- Runtime stage: serve dist/ with nginx ----------
FROM nginx:stable-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Coolify / compose health check (busybox wget ships in the alpine image).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
