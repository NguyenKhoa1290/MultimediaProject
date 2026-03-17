# Sử dụng image Node.js chính thức làm base
FROM node:22

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json để cài đặt dependencies trước
# Điều này giúp tận dụng cache của Docker
COPY package*.json ./

# Cài đặt các dependencies
# Lưu ý: sqlite3 có thể cần build tool, image node:22 đã có sẵn
RUN npm install --production

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở cổng 9000 (cổng mà server chạy)
EXPOSE 9000

# Lệnh khởi chạy ứng dụng
CMD ["node", "index.js"]
