FROM node:20-alpine
WORKDIR /app
RUN npm install ws
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
