FROM node:20-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache --virtual .gyp python3 make g++ || true
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
RUN apk del .gyp || true
ENV PORT=3000
EXPOSE 3000
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node","server.js"]
