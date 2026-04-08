# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install

# Copy mã nguồn và build dự án
COPY . .
# Biến môi trường lúc build
ARG REACT_APP_BACKEND_URL=https://backend.cachephoarong.click
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN npm run build

# --- Stage 2: Production (Dùng Nginx siêu nhẹ) ---
FROM nginx:alpine

# Copy file build từ stage 1 vào thư mục mặc định của Nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copy cấu hình Nginx tùy chỉnh (Lắng nghe cổng 5069 + SSL)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy chứng chỉ SSL
COPY certs /etc/nginx/certs

# Mở cổng 5069
EXPOSE 5069

CMD ["nginx", "-g", "daemon off;"]
