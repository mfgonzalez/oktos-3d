# Multi-stage build: build the React client, then run the Express server
# which serves both the API and the built client static assets.

FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 4000
WORKDIR /app/server
CMD ["node", "index.js"]
