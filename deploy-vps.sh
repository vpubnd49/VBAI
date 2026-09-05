#!/bin/bash
# ==============================================================================
# Script tự động triển khai VBAI trên VPS Ubuntu 24.04-LTS
# ==============================================================================

set -euo pipefail

# Production contract: provide the exact immutable commit and public origin list.
: "${RELEASE_SHA:?Set RELEASE_SHA to the exact Git commit SHA to deploy}"
: "${ALLOWED_ORIGINS:?Set ALLOWED_ORIGINS to a comma-separated production origin list}"
if [[ ! "$RELEASE_SHA" =~ ^[0-9a-fA-F]{40,64}$ ]]; then
    echo "RELEASE_SHA must be an exact 40-64 character Git SHA"
    exit 1
fi
APP_ENV="production"
NODE_ENV="production"

# Khai báo biến đường dẫn
APP_DIR="/var/www/vbai"
# Backend chỉ bind loopback; Nginx là public entrypoint.
BACKEND_PORT=8080
BACKEND_HOST=127.0.0.1

# 1. Cập nhật hệ thống và cài đặt công cụ cần thiết
echo "=== 1. Đang cập nhật hệ thống và cài đặt Git, Nginx ==="
sudo apt-get update -y
sudo apt-get install -y git curl nginx build-essential

# 2. Cài đặt Node.js 20 LTS (NodeSource)
if ! command -v node &> /dev/null; then
    echo "=== 2. Đang cài đặt Node.js v20 LTS ==="
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "=== Node.js đã được cài đặt: $(node -v) ==="
fi

# 3. Cài đặt PM2 toàn cục
if ! command -v pm2 &> /dev/null; then
    echo "=== 3. Đang cài đặt PM2 ==="
    sudo npm install -g pm2
fi

# 4. Thiết lập thư mục chứa source code
echo "=== 4. Cấu hình thư mục ứng dụng ==="
if [ ! -d "$APP_DIR" ]; then
    echo "Thư mục $APP_DIR chưa tồn tại. Tiến hành clone repository..."
    # Clone từ github.com/vpubnd49/VBAI.git
    # Sử dụng lệnh clone thủ công hoặc nếu chạy script này trong repo có sẵn
    sudo mkdir -p /var/www
    sudo chown -R $USER:$USER /var/www
    git clone https://github.com/vpubnd49/VBAI.git "$APP_DIR"
else
    echo "Thư mục $APP_DIR đã tồn tại. Đang cập nhật code mới nhất..."
    cd "$APP_DIR"
fi

cd "$APP_DIR"
git fetch --prune origin
git checkout --detach "$RELEASE_SHA"
test "$(git rev-parse HEAD)" = "$RELEASE_SHA"

# 5. Cài đặt dependency & Build Frontend
echo "=== 5. Cài đặt dependencies và Build Frontend ==="
cd "$APP_DIR/webapp"
npm ci
npm run build

# 6. Cài đặt dependency cho Backend Proxy
echo "=== 6. Cài đặt dependencies cho Backend Proxy ==="
cd "$APP_DIR/proxy"
npm ci

# Kiểm tra tệp tin service-account.json
if [ ! -f "$APP_DIR/proxy/service-account.json" ]; then
    echo "======================================================================"
    echo "⚠️  CẢNH BÁO: Không tìm thấy tệp proxy/service-account.json!"
    echo "Bạn cần sao chép tệp service-account.json từ máy cục bộ của bạn vào:"
    echo "  $APP_DIR/proxy/service-account.json"
    echo "Hoặc chạy lệnh sau từ máy cá nhân của bạn để sao chép:"
    echo "  scp -P 24700 proxy/service-account.json root@202.92.7.138:$APP_DIR/proxy/"
    echo "======================================================================"
    exit 1
fi
sudo chmod 600 "$APP_DIR/proxy/service-account.json"

# 7. Cấu hình khởi chạy Backend bằng PM2
echo "=== 7. Khởi chạy Backend Proxy với PM2 ==="
cd "$APP_DIR/proxy"
pm2 delete vbai-proxy 2>/dev/null || true
APP_ENV="$APP_ENV" NODE_ENV="$NODE_ENV" HOST="$BACKEND_HOST" PORT="$BACKEND_PORT" ALLOWED_ORIGINS="$ALLOWED_ORIGINS" pm2 start server.js --name "vbai-proxy"
pm2 save

# 8. Health gate: fail deployment unless the exact release is serving locally.
echo "=== 8. Kiểm tra health backend ==="
for attempt in 1 2 3 4 5; do
    if curl --fail --silent --show-error --max-time 10 "http://$BACKEND_HOST:$BACKEND_PORT/health" > /dev/null; then
        break
    fi
    if [ "$attempt" -eq 5 ]; then
        echo "Backend health check failed"
        exit 1
    fi
    sleep 2
done

# Không thay đổi user hoặc lifecycle policy của PM2 trong script triển khai.

# 9. Cấu hình Nginx làm Web Server & Reverse Proxy
echo "=== 9. Cấu hình Nginx ==="
NGINX_CONF="/etc/nginx/sites-available/vbai"

sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name localhost;

    # Cho phép tải lên tệp âm thanh cuộc họp lớn (500MB)
    client_max_body_size 500m;

    # Compression (Gzip)
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml;

    # Serving Frontend Static Files
    location / {
        root $APP_DIR/webapp/dist;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # Cấm cache với các file HTML
    location ~* \.html\$ {
        root $APP_DIR/webapp/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires 0;
    }

    # Cấm cache với các file JS/CSS để cập nhật tức thì khi deploy
    location ~* \.(js|css)\$ {
        root $APP_DIR/webapp/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires 0;
    }

    # Proxy các request API đến Backend Local Proxy
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Authorization \$http_authorization;
        proxy_redirect off;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Proxy Firebase Auth helper
    location ^~ /__/auth/ {
        proxy_pass https://gen-lang-client-0462350485.firebaseapp.com;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host gen-lang-client-0462350485.firebaseapp.com;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;

        add_header Cache-Control "no-store" always;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Kích hoạt cấu hình Nginx và restart service
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "======================================================================"
echo "🎉 VBAI ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG TRÊN VPS!"
echo "📍 Giao diện web: http://202.92.7.138/"
echo "📍 Backend API (Nội bộ): http://localhost:$BACKEND_PORT"
echo "👉 Hãy đảm bảo bạn đã copy tệp 'service-account.json' vào thư mục '$APP_DIR/proxy/' để AI hoạt động!"
echo "======================================================================"
