<div align="center">

# 🎨 sub2-image-v2

[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)

**落羽小站 / Sub2 API 聚合服务的内嵌 AI 画廊定制版**

提供简洁精美的 Web UI，支持 OpenAI / OpenAI 兼容接口、sub2api（异步）、fal.ai 与可导入的自定义 HTTP 供应商。<br>
支持文本生图、参考图与遮罩编辑，数据纯本地化存储，带来流畅的历史记录与参数管理体验。

<br>

[![Sub2 Gallery](https://img.shields.io/badge/Sub2-%E5%86%85%E5%B5%8C%E7%94%BB%E5%BB%8A-f97316?style=for-the-badge)](https://sub2.luoyv.net/gallery)

</div>

<br>

> 说明：这是面向落羽小站实际部署的定制备份仓库，基于上游 [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) 移植 Sub2 定制层，上游项目采用 MIT 许可。

---

## ✨ 主要功能

### 图像生成与编辑
- **参考图与遮罩**：支持上传最多 16 张参考图（剪贴板/拖拽）。内置可视化遮罩编辑器，自动预处理以符合官方分辨率限制。
- **批量与迭代**：单次多图生成；一键将满意结果转为参考图继续下一轮修改。
- **流式生成预览**：`Images API` 与 `Responses API` 模式均支持流式接收中间步骤图像。
- **透明背景（API 原生 / 本地后处理双模式）**：每个 API 配置可独立选择实现方式（设置入口在 API 配置页）。

### Agent 多轮绘图
- 对话式绘图，引用前面轮次图片或通过 `@` 选择画廊图片。
- 对话/绘图分离配置（如对话用 Claude、绘图用 GPT 图像模型）。
- Agent 快捷开关、并发生成、分支与重生成、画廊联动。

### 高效历史管理（纯本地）
- 瀑布流与画廊、按状态过滤、全屏预览与快捷下载。
- 多收藏夹管理、批量框选/侧滑多选、IndexedDB 本地存储（SHA-256 去重压缩），一键导出 ZIP 备份。

### 多配置与供应商
- 多 API 配置保存与切换；内置 OpenAI 兼容、sub2api（异步）、fal.ai，并支持 JSON 导入自定义 HTTP 供应商。
- API 代理：OpenAI 兼容与 fal.ai 可配置自定义代理；OpenAI 兼容可开启同源 `/api-proxy/` 代理绕开 CORS。
- Codex CLI 兼容模式、提示词防改写、智能诊断提示。

---

## 🚀 部署与使用

支持多种部署与开发方式。所有部署方式都可通过环境变量提供「预置配置」。

<a id="preset-config"></a>
### 预置配置说明

环境变量的值支持三种填写方式：

| 填写方式 | 说明 | 示例 |
|------|------|------|
| **直接填写 API 地址** | 自动创建一个 OpenAI 兼容的默认预置配置（ID 为 `default-openai`）并注入 API URL，用户只需补充 API Key。 | `https://api.openai.com/v1` |
| **API 地址 + 查询参数** | 在地址后追加参数，可同时预填 Key、模型等字段。 | `https://api.openai.com/v1?model=gpt-image-2&apiMode=responses` |
| **JSON 配置文件 / 导入链接** | 通过仓库内或本地的 JSON 文件路径、远程 URL 或含 `?settings=` 参数的导入链接提供完整预置配置。 | 详见 [预置配置 JSON 格式](#preset-config-json) |

**环境变量一览**

| 构建时变量 (Vercel/CF/本地) | Docker 运行变量 | 功能说明 |
|------|------|------|
| `VITE_DEFAULT_API_URL` | `DEFAULT_API_URL` | 设定预置配置值（URL 形式或 JSON 格式） |
| `VITE_LOCK_PRESET_CONFIG_PARAMS=true` | `LOCK_PRESET_CONFIG_PARAMS=true` | 锁定预置配置中除 API Key 外的参数，并禁止编辑预置供应商定义 |
| `VITE_PREVENT_PRESET_CONFIG_DELETION=true` | `PREVENT_PRESET_CONFIG_DELETION=true` | 禁止删除预置配置和预置供应商 |
| `VITE_SHOW_PRESET_CONFIG_ONLY=true` | `SHOW_PRESET_CONFIG_ONLY=true` | 只允许使用当前预置配置，禁止创建/复制/删除/切换供应商 |

### 部署方式

<a id="docker-deployment"></a>
#### 🐳 方式一：Docker 部署

支持通过官方发布的 Docker 镜像在服务器或本地容器环境中快速运行（本仓库同时提供 `docker-compose.yml`）。

**环境变量**

| 变量 | 说明 |
|------|------|
| `DEFAULT_API_URL` | 预置配置，支持上述三种填写方式 |
| `ENABLE_API_PROXY=true` | 开启 Nginx 同源代理，请求发往 `/api-proxy/{路径}` 再转发到 `API_PROXY_URL` |
| `API_PROXY_URL` | 代理转发的完整 API 基础地址（不自动补 `/v1`） |
| `LOCK_API_PROXY=true` | 强制锁定代理为开启，用户无法关闭 |
| `HOST` / `PORT` | Nginx 监听地址和端口，默认 `0.0.0.0:80` |

> 开启 API 代理后，任何人都能将你的服务器作为代理来请求目标 API。建议仅在有访问控制（如 IP 白名单）或本地网络中开启。

**隐藏真实 API 地址**

配合 `ENABLE_API_PROXY=true` + `LOCK_API_PROXY=true` 可隐藏上游地址：

- OpenAI 兼容接口：`DEFAULT_API_URL` 留空或填占位地址（如 `https://proxy`）。
- 自定义供应商：JSON 中配置的 `baseUrl` 留空并设置 `apiProxy: true`（仅支持同步配置）。

**Docker Compose 示例**

```yaml
services:
  gpt-image-playground:
    build:
      context: .
      dockerfile: deploy/Dockerfile
    container_name: gpt_image_playground
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:80"
    environment:
      DEFAULT_API_URL: ""
      API_PROXY_URL: "https://sub2.luoyv.net/v1"
      SUB2API_ACCOUNT_BASE_URL: "/api-proxy/api/v1"
      SUB2API_ACCOUNT_PROXY_URL: "https://sub2.luoyv.net/api/v1"
      ENABLE_API_PROXY: "true"
      LOCK_API_PROXY: "true"
```

#### 💻 方式二：本地开发与静态构建

```bash
npm install
npm run dev
```

构建静态产物：

```bash
npm run build
```

构建产物输出到 `dist/`，可交给 Nginx、Docker 或其它静态服务器部署。

本地开发跨域代理（可选）：

```bash
cp dev-proxy.config.example.json dev-proxy.config.json
```

修改 `target` 为真实完整 API 基础地址（不自动补 `/v1`，OpenAI 兼容通常需填到版本前缀），重启开发服务器后在页面设置开启 **API 代理** 即可。

<a id="url-quick-fill"></a>
## 🛠️ URL 传参快速填充

通过 URL 查询参数快速填入 OpenAI 兼容配置，适合创建书签或集成分享。

| 参数 | 说明 | 示例 |
|------|------|------|
| `apiUrl` | API Base URL | `?apiUrl=https://api.example.com/v1` |
| `apiKey` | API Key | `?apiKey=sk-xxxx` |
| `model` | 模型 ID（未传时按 apiMode 使用默认模型） | `?model=gpt-image-2` |
| `apiMode` | `images` 或 `responses`，默认 `images` | `?apiMode=responses` |
| `profileName` | 配置名称，默认“URL 参数配置” | `?profileName=我的配置` |
| `reasoningEffort` | Responses API 推理强度 | `?reasoningEffort=high` |
| `codexCli` | Codex CLI 兼容模式 | `?codexCli=true` |
| `streamImages` | 流式传输 | `?streamImages=true` |
| `streamPartialImages` | 中间步骤图像数（需配合 streamImages） | `?streamPartialImages=2` |
| `profileId` | 目标配置 ID；匹配到同 ID 配置时直接更新 | `?profileId=my-service` |
| `transparentBackgroundMethod` | 透明背景实现方式：`api`（原生）或 `local`（本地后处理） | `?transparentBackgroundMethod=local` |

<a id="preset-config-json"></a>
## 📋 预置配置 JSON 格式

使用 JSON 文件或分享链接提供预置配置时，JSON 对象包含两个顶层字段：

- **`customProviders`**（数组）：自定义供应商定义。仅使用内置供应商时留空 `[]` 即可。
- **`profiles`**（数组）：预置的 API 配置列表。每项对应用户配置页中的一个配置条目。

### 配置列表字段说明（`profiles`）

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 定向更新时填写 | 用于标识配置条目；若后续链接携带相同 ID 将直接更新该条目而非新建。 |
| `name` | 是 | 配置名称，方便用户识别。 |
| `description` | 否 | 配置说明，支持 Markdown。 |
| `provider` | 是 | 供应商类型。`"openai"` 为 OpenAI 兼容接口，`"sb2api-async"` 为 sub2api（异步），`"fal"` 为 fal.ai，其他值引用 `customProviders` 中具有相同 ID 的供应商定义。 |
| `baseUrl` | 是 | API 基础地址（Base URL）。未以 `/` 结尾时自动补齐 `/v1`；以 `/` 结尾时直接基于该地址请求；fal.ai 可留空。 |
| `apiKey` | 否 | API Key。建议省略，让用户导入后自行填写。 |
| `model` | 是 | 默认模型 ID。 |
| `apiMode` | 否 | `"images"` 或 `"responses"`，默认 `"images"`。 |
| `isDefault` | 否 | 有多个配置时，为默认项设置 `true`（只能有一个）。 |
| `timeout` | 否 | 请求超时秒数，默认 600。 |
| `apiProxy` | 否 | 是否走部署端 API 代理，默认 `false`。 |
| `transparentBackgroundMethod` | 否 | 透明背景实现方式：`"api"`（API 原生）或 `"local"`（本地后处理）。 |

### 示例：仅 OpenAI 兼容

```json
{
  "customProviders": [],
  "profiles": [
    {
      "id": "my-openai",
      "name": "我的 OpenAI 配置",
      "description": "使用前请阅读 [接口说明](https://example.com/docs)。",
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-image-2"
    }
  ]
}
```

### 示例：OpenAI 兼容 + sub2api + fal.ai 多配置

```json
{
  "customProviders": [],
  "profiles": [
    {
      "id": "openai-main",
      "name": "OpenAI",
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-image-2",
      "isDefault": true
    },
    {
      "id": "sub2api-profile",
      "name": "sub2api 异步",
      "provider": "sb2api-async",
      "baseUrl": "https://api.example.com/v1",
      "model": "gpt-image-2"
    },
    {
      "id": "fal-profile",
      "name": "fal.ai",
      "provider": "fal",
      "baseUrl": "",
      "model": "openai/gpt-image-2"
    }
  ]
}
```

### 如何将预置配置提供给环境变量

预置配置 JSON 可通过以下三种方式填入部署环境变量（`VITE_DEFAULT_API_URL` 或 Docker 的 `DEFAULT_API_URL`）：

1. **导入链接（单配置导入，最简单）**：在在线体验中配置好条目后，复制含 `?settings=` 参数的 URL 直接填入环境变量。
2. **仓库内／本地配置文件（推荐）**：指定仓库根目录或本地文件相对路径（如 `./gpt-image-config.example.json`），构建时自动读取并内嵌。
3. **HTTP／HTTPS 远程配置文件**：将 JSON 保存到部署服务器能访问的 URL，构建时或容器启动时会自动读取并内嵌。

<a id="custom-provider-config"></a>
## 🔌 自定义供应商

当 API 不是标准 OpenAI 格式时，需要在 `customProviders` 中定义请求和响应结构。每个供应商定义必须有唯一的 `id`，由 `profiles` 中配置的 `provider` 字段引用。

若自定义供应商的接口不在 `/v1` 路径下，请将 `baseUrl` 设置为以 `/` 结尾。

**完整 JSON 示例（含异步任务供应商定义）：**

```json
{
  "customProviders": [
    {
      "id": "custom-example-task",
      "name": "示例异步任务供应商",
      "submit": {
        "path": "images/generations",
        "method": "POST",
        "contentType": "json",
        "body": {
          "model": "$profile.model",
          "prompt": "$prompt",
          "size": "$params.size",
          "quality": "$params.quality",
          "output_format": "$params.output_format",
          "output_compression": "$params.output_compression",
          "n": "$params.n",
          "image_urls": "$inputImages.dataUrls"
        },
        "taskIdPath": "data.0.task_id"
      },
      "poll": {
        "path": "tasks/{task_id}",
        "method": "GET",
        "intervalSeconds": 5,
        "statusPath": "data.status",
        "successValues": ["completed"],
        "failureValues": ["failed", "cancelled"],
        "errorPath": "data.error.message",
        "result": {
          "imageUrlPaths": ["data.result.images.*.url.*"],
          "b64JsonPaths": []
        }
      }
    }
  ],
  "profiles": [
    {
      "id": "example-profile",
      "name": "示例异步任务供应商",
      "provider": "custom-example-task",
      "baseUrl": "https://api.example.com/v1",
      "model": "gpt-image-2",
      "apiMode": "images"
    }
  ]
}
```

## 📄 许可证 & 致谢

本项目基于 [GPT Image Playground](https://github.com/CookSleep/gpt_image_playground) 二次开发，上游项目使用 [MIT License](LICENSE)。

特别致谢：[LINUX DO](https://linux.do)

---

## Sub2 定制版（sub2-image-v2）

本仓库在**上游最新版**基础上移植了 luoyv66/sub2-image 的 Sub2 定制层：

- **嵌入式模式**：URL 带 `ui_mode=embedded` 时进入嵌入式图库（`src/lib/embeddedMode.ts`）
- **Sub2 账号同步**：嵌入模式下自动从 URL 同步账号/令牌/密钥（`src/lib/embeddedSub2Api.ts`、`src/lib/sub2apiAccount.ts`），设置面板含「账号」标签页
- **内置 sb2api-async 异步服务商**：提交/轮询异步生图任务
- **多服务商**：OpenAI / sb2api-async / fal / Grok / Gemini / Claude
- **部署配置**：`docker-compose.yml`、nginx 同源代理（`/api-proxy`）、`SUB2API_ACCOUNT_*` 环境变量

构建方式与上游一致：`npm install && npm run dev`（或 `npm run build`）。
