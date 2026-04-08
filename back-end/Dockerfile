# --- Giai đoạn 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Chỉ copy package.json để tận dụng cache của Docker
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả build tools cho sqlite3)
# Alpine cần thêm một số thư viện để biên dịch native module như sqlite3
RUN apk add --no-cache python3 make g++ \
    && npm install

# Copy toàn bộ mã nguồn
COPY . .

# --- Giai đoạn 2: Production (Giai đoạn này sẽ tạo ra Image cuối cùng) ---
FROM node:20-alpine

WORKDIR /app

# Copy node_modules và code từ giai đoạn build
COPY --from=builder /app .

# Dọn dẹp: Xóa bớt các thư viện không cần thiết cho production
RUN npm prune --production

# Tạo thư mục lưu trữ nếu chưa có
RUN mkdir -p public/uploads public/avatars

# Mở cổng 9000
EXPOSE 9000

CMD ["node", "index.js"]
