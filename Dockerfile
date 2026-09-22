# 建置階段：Vite 產生純靜態檔
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# 這台機器的環境是 NODE_ENV=production，不加 --include=dev 會漏裝建置用的依賴
RUN npm install --include=dev
COPY . .
RUN npm run build

# 執行階段：只有一個 nginx 在送靜態檔，沒有 node
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
