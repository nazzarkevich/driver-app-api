# Use an official Node.js runtime as a base image
FROM node:20.11-alpine as base

# Set the working directory in the container
WORKDIR /driver-app-api

# Copy package.json and package-lock.json to the working directory
COPY ["package.json", "yarn.lock*", "./"]

COPY prisma ./prisma/

FROM base AS dev

RUN yarn install --fozen-lockfile

COPY . .

CMD ["yarn", "start:dev"]

# Install application dependencies
FROM base AS prod

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN yarn install --fozen-lockfile --production

COPY . .

RUN yarn add global @nestjs/cli

RUN yarn build

EXPOSE 8080

CMD ["yarn", "start:prod"]