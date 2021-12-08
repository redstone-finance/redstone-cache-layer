# This Dockerfile contains a docker container configuration
# for redstone cache layer express app with the lite mode
# The app in the lite mode doesn't store historical data and uses
# memory as a storage instead of Mongo DB

FROM node:14

WORKDIR /var/task/

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn

COPY . .

ENV MODE=PROD

ENV LIGHT_MODE = true

EXPOSE 9000
CMD [ "yarn", "start" ]
