# Build Expo Web, then serve only the static artifact with Nginx.
FROM node:22-bookworm-slim AS web-build

WORKDIR /app
ENV CI=1

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Apply the repository patches without running an uncontrolled install.
RUN npm run postinstall

# The public APK is part of the production vitrine download contract.
RUN test -s public/app-release.apk
RUN npx expo export --platform web

FROM nginx:1.29-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1
