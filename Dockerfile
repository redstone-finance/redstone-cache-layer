FROM public.ecr.aws/lambda/nodejs:14

WORKDIR /var/task/

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN npm i -g yarn
RUN yarn

COPY . .

ENV MODE=PROD

CMD [ "index.handler" ]
