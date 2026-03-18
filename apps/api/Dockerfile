FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN yarn install --immutable

COPY apps/api ./apps/api

WORKDIR /app/apps/api

RUN yarn build

EXPOSE 3010

CMD ["yarn", "start"]
