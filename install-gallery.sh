#!/usr/bin/env bash
# ============================================================
# sub2-image-v2 画廊容器 一键部署脚本
# 适用: 已安装 docker + docker compose 的 Linux 服务器
# 运行: bash install-gallery.sh
# 说明: 源码克隆到 /opt/sub2-image-v2, 域名配置写入
#       docker-compose.override.yml (git 不跟踪, 升级 pull 不会被覆盖)
# ============================================================
set -euo pipefail

DOMAIN="api.pansos.cn"
APP_DIR="/opt/sub2-image-v2"
REPO="https://github.com/wosucan/sub2-image-v2.git"

echo "==> [1/4] 克隆/更新源码到 $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "    目录已存在, 拉取最新代码"
  git -C "$APP_DIR" pull --ff-only 2>/dev/null || echo "    (pull 跳过)"
else
  echo "    克隆源码 (可能需要 1-2 分钟)..."
  git clone "$REPO" "$APP_DIR"
fi

echo "==> [2/4] 写入 docker-compose.override.yml (域名: $DOMAIN, 不改动原配置)"
cat > "$APP_DIR/docker-compose.override.yml" <<EOF
services:
  gpt-image-playground:
    environment:
      DEFAULT_API_URL: ""
      API_PROXY_URL: "https://${DOMAIN}/v1"
      SUB2API_ACCOUNT_BASE_URL: "/api-proxy/api/v1"
      SUB2API_ACCOUNT_PROXY_URL: "https://${DOMAIN}/api/v1"
      ENABLE_API_PROXY: "true"
      LOCK_API_PROXY: "true"
EOF

echo "==> [3/4] 构建并启动 (首次需 npm install, 约 3-10 分钟)"
cd "$APP_DIR"
docker compose up -d --build

echo "==> [4/4] 等待并健康检查"
for i in $(seq 1 36); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/"; then
    echo "✅ 画廊容器已就绪: http://127.0.0.1:3000/"
    break
  fi
  sleep 5
done

echo ""
echo "=========================================================="
echo "画廊容器已启动, 还差最后一步 (配置外层 Nginx):"
echo "  运行:  sudo bash setup-nginx.sh"
echo "  或手动把教程里的 Nginx 片段加入你的站点配置后 reload"
echo "完成后访问:  https://${DOMAIN}/gallery/"
echo "=========================================================="
