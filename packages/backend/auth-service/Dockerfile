FROM node:18-alpine

RUN addgroup -S node_user && adduser -S node_user -G node_user

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

USER node_user

CMD [ "npm", "start" ]
