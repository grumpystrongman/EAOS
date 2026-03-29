FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json tsconfig.base.json ./
COPY backend ./backend
RUN npm install
RUN npm run build --workspace @eaos/tool-registry

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/backend/services/tool-registry/dist ./dist
COPY --from=build /workspace/backend/services/tool-registry/package.json ./package.json
CMD ["node", "dist/index.js"]