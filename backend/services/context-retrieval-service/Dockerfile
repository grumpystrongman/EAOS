FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json tsconfig.base.json ./
COPY backend ./backend
RUN npm install
RUN npm run build --workspace @eaos/context-retrieval-service

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/backend/services/context-retrieval-service/dist ./dist
COPY --from=build /workspace/backend/services/context-retrieval-service/package.json ./package.json
CMD ["node", "dist/index.js"]