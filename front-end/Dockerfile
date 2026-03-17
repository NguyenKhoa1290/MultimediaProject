# Stage 1: Build React App
FROM node:22 AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build ứng dụng (tạo thư mục build)
RUN npm run build

# Stage 2: Chạy bằng Nginx
FROM nginx:stable-alpine

# Tạo thư mục chứa chứng chỉ
RUN mkdir -p /etc/nginx/certs

# Copy các file đã build vào thư mục phục vụ của Nginx
COPY --from=build-stage /app/build /usr/share/nginx/html

# Copy chứng chỉ SSL vào container
COPY certs/127.0.0.1.crt /etc/nginx/certs/server.crt
COPY certs/127.0.0.1.key /etc/nginx/certs/server.key

# Cấu hình Nginx để chạy trên cổng 5069 với HTTPS
RUN printf "server {\n\
    listen 5069 ssl;\n\
    ssl_certificate /etc/nginx/certs/server.crt;\n\
    ssl_certificate_key /etc/nginx/certs/server.key;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}" > /etc/nginx/conf.d/default.conf

EXPOSE 5069
CMD ["nginx", "-g", "daemon off;"]

