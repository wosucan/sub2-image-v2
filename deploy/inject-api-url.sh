#!/bin/sh

# Replace Vite build placeholders with Docker runtime configuration.
# An explicitly empty DEFAULT_API_URL stays empty so locked proxy deployments do not expose an upstream URL.
if [ "${DEFAULT_API_URL+x}" != "x" ]; then
    DEFAULT_API_URL=${API_URL:-https://api.openai.com/v1}
fi
DOCKER_LEGACY_API_URL_USED=${DOCKER_LEGACY_API_URL_USED:-false}
if [ -n "$API_URL" ]; then
    DOCKER_LEGACY_API_URL_USED=true
fi

API_PROXY_AVAILABLE=false
if [ "$ENABLE_API_PROXY" = "true" ]; then
    API_PROXY_AVAILABLE=true
fi

API_PROXY_TARGET=${API_PROXY_URL:-}
SUB2API_ACCOUNT_BASE_URL=${SUB2API_ACCOUNT_BASE_URL:-}
SUB2API_ACCOUNT_PROXY_URL=${SUB2API_ACCOUNT_PROXY_URL:-}
if [ -z "$SUB2API_ACCOUNT_PROXY_URL" ]; then
    SUB2API_ACCOUNT_PROXY_URL=$(printf '%s' "$API_PROXY_TARGET" | sed 's|/v[0-9][0-9a-zA-Z]*$|/api/v1|')
fi

API_PROXY_LOCKED=false
if [ "$ENABLE_API_PROXY" = "true" ] && [ "$LOCK_API_PROXY" = "true" ]; then
    API_PROXY_LOCKED=true
fi

PRESET_CONFIG_ONLY=false
if [ "$SHOW_PRESET_CONFIG_ONLY" = "true" ] || [ "$SHOW_DEFAULT_CONFIG_ONLY" = "true" ]; then
    PRESET_CONFIG_ONLY=true
fi

PRESET_CONFIG_PARAMS_LOCKED=false
if [ "$LOCK_PRESET_CONFIG_PARAMS" = "true" ]; then
    PRESET_CONFIG_PARAMS_LOCKED=true
fi

PRESET_CONFIG_DELETION_PREVENTED=false
if [ "$PREVENT_PRESET_CONFIG_DELETION" = "true" ]; then
    PRESET_CONFIG_DELETION_PREVENTED=true
fi

escape_sed_replacement() {
    printf '%s' "$1" | sed 's/[&|\\]/\\&/g'
}

escape_js_string() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

DEFAULT_API_URL_TRIMMED=$(printf '%s' "$DEFAULT_API_URL" | sed 's/^[[:space:]]*//')
case "$DEFAULT_API_URL_TRIMMED" in
    http://*|https://*)
        DEFAULT_CONFIG_URL_PATH=${DEFAULT_API_URL_TRIMMED%%\?*}
        DEFAULT_CONFIG_URL_PATH=${DEFAULT_CONFIG_URL_PATH%%\#*}
        DEFAULT_CONFIG_URL_PATH_LOWER=$(printf '%s' "$DEFAULT_CONFIG_URL_PATH" | tr '[:upper:]' '[:lower:]')
        case "$DEFAULT_CONFIG_URL_PATH_LOWER" in
            *.json)
                if ! DEFAULT_CONFIG_JSON=$(wget -qO- "$DEFAULT_API_URL_TRIMMED"); then
                    echo "预置配置请求失败：$DEFAULT_API_URL_TRIMMED" >&2
                    exit 1
                fi
                DEFAULT_API_URL="embedded-config:$(printf '%s' "$DEFAULT_CONFIG_JSON" | base64 | tr -d '\n')"
                ;;
        esac
        ;;
    file://*)
        DEFAULT_CONFIG_PATH=${DEFAULT_API_URL_TRIMMED#file://}
        if [ ! -f "$DEFAULT_CONFIG_PATH" ]; then
            echo "预置配置文件不存在：$DEFAULT_CONFIG_PATH" >&2
            exit 1
        fi
        DEFAULT_API_URL="embedded-config:$(base64 < "$DEFAULT_CONFIG_PATH" | tr -d '\n')"
        ;;
    *)
        if [ -f "$DEFAULT_API_URL_TRIMMED" ]; then
            DEFAULT_API_URL="embedded-config:$(base64 < "$DEFAULT_API_URL_TRIMMED" | tr -d '\n')"
        else
            case "$DEFAULT_API_URL_TRIMMED" in
                *.json)
                    echo "预置配置文件不存在：$DEFAULT_API_URL_TRIMMED" >&2
                    exit 1
                    ;;
            esac
        fi
        ;;
esac
DEFAULT_API_URL_ESCAPED=$(escape_sed_replacement "$(escape_js_string "$DEFAULT_API_URL")")
API_PROXY_TARGET_ESCAPED=$(escape_sed_replacement "$(escape_js_string "$API_PROXY_TARGET")")
SUB2API_ACCOUNT_BASE_URL_ESCAPED=$(escape_sed_replacement "$(escape_js_string "$SUB2API_ACCOUNT_BASE_URL")")

find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_DEFAULT_API_URL_PLACEHOLDER__|$DEFAULT_API_URL_ESCAPED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_API_PROXY_AVAILABLE_PLACEHOLDER__|$API_PROXY_AVAILABLE|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_API_PROXY_LOCKED_PLACEHOLDER__|$API_PROXY_LOCKED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_API_PROXY_TARGET_PLACEHOLDER__|$API_PROXY_TARGET_ESCAPED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_SUB2API_ACCOUNT_BASE_URL_PLACEHOLDER__|$SUB2API_ACCOUNT_BASE_URL_ESCAPED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_DOCKER_DEPLOYMENT_PLACEHOLDER__|true|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_DOCKER_LEGACY_API_URL_USED_PLACEHOLDER__|$DOCKER_LEGACY_API_URL_USED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_SHOW_PRESET_CONFIG_ONLY_PLACEHOLDER__|$PRESET_CONFIG_ONLY|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_LOCK_PRESET_CONFIG_PARAMS_PLACEHOLDER__|$PRESET_CONFIG_PARAMS_LOCKED|g" {} +
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_PREVENT_PRESET_CONFIG_DELETION_PLACEHOLDER__|$PRESET_CONFIG_DELETION_PREVENTED|g" {} +

if [ "$ENABLE_API_PROXY" != "true" ]; then
    sed -i '/# BEGIN API PROXY/,/# END API PROXY/d' /etc/nginx/conf.d/default.conf
fi

exec "$@"
