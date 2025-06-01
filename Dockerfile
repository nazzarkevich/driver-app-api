FROM node:20.11-alpine

# Install OpenSSL
RUN apk add --no-cache openssl

WORKDIR /driver-app-api

# Copy package files
COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Build application
RUN yarn build

# Set production environment
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/src/main.js"]