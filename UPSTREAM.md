# 上游来源与改造说明

本仓库是二次改造分支，**保留上游全部功能**，仅增量添加 Sub2（sub2api）账号与 API Key 自动同步能力。

## 上游与本分支

| 项目 | 地址 | 许可 | 关系 |
| --- | --- | --- | --- |
| GPT Image Playground | `CookSleep/gpt_image_playground` | MIT | **基座**，保留其全部功能与新版本特性 |
| sub2-image | `luoyv66/sub2-image` | MIT | **参考实现**，本分支 Sub2 集成层的设计来源 |

- 基座版本：**v0.7.12**
- 本分支对外名称：**画廊-盘搜API**（`@盘搜API`）
- 参考实现的 Sub2 集成层：完整移植，并做了同源适配与「全部 Key」补全

## 改造原则

1. **上游特性不回退**：v0.7.12 的预置配置（远程 URL / 本地文件 / base64 内嵌）、Agent 模式、
   多供应商、PWA 等能力全部保留；新增内容一律采用**增量**方式，不删除上游既有环境变量与配置。
2. **只移植 Sub2 集成层**：参考实现中夹杂的第三方分支功能（Gemini / Claude / Grok 供应商、
   请求队列等）不属于 Sub2 集成，未引入。
3. **补全「全部 Key」能力**：参考实现会遍历所有 profile、为每个 profile 从完整 Key 列表中
   匹配各自密钥；同时提供设置页手动切换。

## 文件级变更

### 新增

| 文件 | 说明 |
| --- | --- |
| `src/lib/embeddedMode.ts` | 嵌入模式识别（`ui_mode=embedded`） |
| `src/lib/sub2apiAccount.ts` | sub2api 账号 API 客户端：登录、2FA、当前用户、**Key 列表** |
| `src/lib/embeddedSub2Api.ts` | 从 URL 取 token、调用同步、把 Key 应用**到所有 profile** |
| `src/lib/sub2apiAccount.test.ts` | 对应单元测试 |
| `docker-compose.example.yml` | 部署示例（上游无 compose 文件，故用 .example 避免冲突） |

### 修改

| 文件 | 改动 |
| --- | --- |
| `src/store.ts` | 新增 Sub2 账号状态切片（账号、密钥列表、同步状态）与持久化 |
| `src/App.tsx` | store 初始化后触发一次账号同步 |
| `src/components/SettingsModal.tsx` | 新增「账号同步」标签页；API 配置页增加同步密钥选择器 |
| `src/components/Header.tsx` | 嵌入模式下隐藏设置入口等不适用的 UI |
| `src/index.css` | 嵌入模式样式钩子 |
| `src/lib/devProxy.ts` | `DevProxyConfig` 增加 `accountTarget`（账号接口独立目标） |
| `src/vite-env.d.ts` | 增加 `VITE_SUB2API_ACCOUNT_BASE_URL` 类型 |
| `vite.config.ts` | 开发服务器增加 `/api-proxy/api/v1` 账号代理路由（排在通配前缀前） |
| `dev-proxy.config.example.json` | 增加 `accountTarget` 示例 |
| `deploy/Dockerfile` | 增加 `SUB2API_ACCOUNT_BASE_URL` / `SUB2API_ACCOUNT_PROXY_URL` 与构建期占位符 |
| `deploy/inject-api-url.sh` | 注入账号接口地址；目标为空时移除账号代理区块；空目标时从 `API_PROXY_URL` 推导 |
| `deploy/nginx.conf` | 新增 `/api-proxy/api/v1/` 账号代理 location |
| `README.md` | 新增分支说明与「Sub2 账号同步」章节 |

## 同步上游

上游迭代频繁。建议流程：

```bash
git remote add upstream https://github.com/CookSleep/gpt_image_playground.git
git fetch upstream
git merge upstream/v<新版本>          # 或 git rebase
```

冲突通常集中在 `SettingsModal.tsx`（账号同步面板所在位置）与 `store.ts`。
解决时**保留双方改动**：上游 UI 变更 + 本分支的账号同步面板与状态。

## 许可证

沿用上游 MIT 许可，见 `LICENSE`。
