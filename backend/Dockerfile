#----------------------------------BUILD---------------------------------

FROM node:25-bullseye AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

# copy only files needed for build stage
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

#---------------------------------RUNTIME--------------------------------

FROM node:25-bullseye

WORKDIR /app

ENV NODE_ENV=production
ENV FORCE_COLOR=1

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

# directory for storing uploaded images (mounted via volume)
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["npm", "run", "start"]
