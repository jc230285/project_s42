# Next.js + Tailwind Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 3150
CMD ["npm", "run", "dev"]
