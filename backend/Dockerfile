#----------------------------------BUILD---------------------------------

FROM node:25-bullseye AS build

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm install

# copy only files needed for build stage
COPY tsconfig.json ./
COPY src ./src

# generate prisma client
COPY prisma ./prisma
RUN npx prisma generate

RUN npm run build

#---------------------------------RUNTIME--------------------------------

FROM node:25-bullseye

WORKDIR /app

ENV NODE_ENV=production
ENV FORCE_COLOR=1

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
# COPY --from=build /app/generated/prisma ./generated/prisma

# directory for storing uploaded images (mounted via volume)
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["npm", "run", "start"]
