# Sử dụng Node.js Alpine cho kích thước nhỏ gọn
FROM node:22-alpine

WORKDIR /app

# Chỉ cài đặt các dependencies cần thiết
COPY package*.json ./
RUN npm install --production

# Copy mã nguồn chính
COPY index.js .

# Mở cổng 3478 cho cả UDP và TCP
EXPOSE 3478/tcp
EXPOSE 3478/udp

# Mở dải cổng Relay (Chuyển tiếp video)
EXPOSE 49152-65535/udp

# Chạy Server
CMD ["node", "index.js"]
