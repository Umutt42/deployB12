# ── Étape 1 : Build Angular ────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# ── Étape 2 : Servir avec Nginx ────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist/b12-admin/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
