#!/usr/bin/env bash
# ============================================================
# 外层 Nginx 反代 一键注入脚本 (需 root)
# 作用: 把画廊容器(127.0.0.1:3000)挂载到 api.pansos.cn 的
#       /gallery/  /assets/  /api-proxy/ 三个路径
# 原理: 自动找到 server_name=api.pansos.cn 的 server 块,
#       在该块内注入 3 段 location (先备份原配置, 幂等可重复执行)
# 运行: sudo bash setup-nginx.sh
# ============================================================
set -euo pipefail

DOMAIN="api.pansos.cn"

echo "==> 查找 server_name=$DOMAIN 的 Nginx server 配置..."
TARGET=""
# 方式1(最可靠): sites-available 下精确文件名匹配, 天然排除所有 .bak/.old 等后缀备份
for cand in "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-available/${DOMAIN}.conf"; do
  if [ -f "$cand" ] && grep -q "server_name[[:space:]].*${DOMAIN}" "$cand" 2>/dev/null; then
    TARGET="$cand"; break
  fi
done
# 方式2: sites-enabled 活跃软链接 -> 解析真实路径
if [ -z "$TARGET" ]; then
  for f in /etc/nginx/sites-enabled/*; do
    if grep -q "server_name[[:space:]].*${DOMAIN}" "$f" 2>/dev/null; then
      r=$(readlink -f "$f")
      [ -f "$r" ] && TARGET="$r" && break
    fi
  done
fi
# 方式3: nginx -T 实际加载的配置文件
if [ -z "$TARGET" ]; then
  TARGET=$(nginx -T 2>/dev/null | grep -E "^# configuration file .*${DOMAIN}" | head -1 | sed -E 's@^# configuration file (.*):@\1@')
fi

if [ -z "$TARGET" ]; then
  echo "❌ 未找到 server_name $DOMAIN 的 server 块。"
  echo "   请手动把下面 3 段 location 加进该 server 块内部, 然后 nginx -s reload:"
  cat <<'MANUAL'
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
MANUAL
  exit 1
fi
echo "    找到: $TARGET"

# 幂等: 已注入过就跳过, 直接校验重载
if grep -q "sub2-image-gallery" "$TARGET"; then
  echo "✅ 反代片段已存在, 跳过注入, 直接校验重载。"
  nginx -t && nginx -s reload
  echo "✅ 完成: https://$DOMAIN/gallery/"
  exit 0
fi

# 备份原配置 (可回滚)
cp "$TARGET" "${TARGET}.bak.$(date +%s)"
echo "    已备份原配置 -> ${TARGET}.bak.<时间戳>"

# 用 python3 在 server_name 行之后注入 location 块
# (heredoc 用引号, 保护 $host/$remote_addr 等 nginx 变量不被 bash 展开)
python3 - "$TARGET" "$DOMAIN" <<'PYEOF'
import sys
path, domain = sys.argv[1], sys.argv[2]
with open(path) as f:
    lines = f.readlines()

block = '''    # ===== sub2-image-v2 画廊 (本地容器 127.0.0.1:3000) =====
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
    # ===== end sub2-image-v2 =====
'''

out = []
injected = False
for line in lines:
    out.append(line)
    # 在第一个 server_name=本域名的行后插入
    if (not injected) and ("server_name" in line) and (domain in line):
        out.append(block)
        injected = True

with open(path, "w") as f:
    f.writelines(out)
print("injected location block:", injected)
PYEOF

echo "    校验并重载 Nginx..."
nginx -t && nginx -s reload && echo "✅ Nginx 已重载: https://$DOMAIN/gallery/"
