FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend ./backend
RUN npm ci
RUN npm run build --workspace @openaegis/context-retrieval-service
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/package-lock.json ./package-lock.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist ./dist
EXPOSE 3009
CMD ["node", "dist/services/context-retrieval-service/src/index.js"]
