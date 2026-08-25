#!/usr/bin/env bash
# ============================================================
# 外层 Nginx 反代片段 一键写入脚本 (需 root)
# 作用: 把画廊容器(127.0.0.1:3000)挂载到 api.pansos.cn 的
#       /gallery/ 和 /api-proxy/ 路径
# 运行: sudo bash setup-nginx.sh
# 注意: 仅适用于 Nginx 直接装在宿主机上的情况。
#       若你的 Nginx 是 Docker 容器, 请改用手动方式(见教程)。
# ============================================================
set -euo pipefail

DOMAIN="api.pansos.cn"
CONF_DIR="/etc/nginx/conf.d"
CONF="$CONF_DIR/sub2-gallery.conf"

if [ ! -d "$CONF_DIR" ]; then
  echo "❌ 未找到 $CONF_DIR, 你的 Nginx 配置目录可能不同。"
  echo "   请参考教程手动添加反代片段。"
  exit 1
fi

cat > "$CONF" <<'EOF'
# ===== sub2-image-v2 画廊 (本地容器 127.0.0.1:3000) =====
location /gallery/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /assets/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
}

location /api-proxy/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
    proxy_request_buffering off;
}
EOF

echo "已写入 $CONF"
nginx -t && nginx -s reload && echo "✅ Nginx 已重载, 访问 https://$DOMAIN/gallery/"
