# RoxMate 本机与 Monad Testnet 部署记录

**当前状态（2026-09-28）**：邀请方向修复版合约已部署到 Monad Testnet，PR #1 已合并；[生产网页](https://roxmate-one.vercel.app/)已发布。旧合约不能原地升级，旧数据不会自动迁移。

## 修复版上线记录

1. `forge test` 8 项、`npm test` 15 项、`npm run lint`、`npm run build` 通过；Vercel Preview 构建通过。
2. 使用原部署账户在 MetaMask 中确认合约创建交易。Foundry 加密账户密码已遗忘，因此没有用 keystore 广播；私钥未导出。
3. `contracts/deployments/10143.json` 已更新到新地址；旧部署记录保存在 `contracts/deployments/10143-legacy.json`。本地 `.env.local` 地址已更新，其他私密配置保留。
4. 新地址是公开常量，已写入 `apps/web/lib/chain.ts`。Vercel 的旧 `NEXT_PUBLIC_REGISTRY_ADDRESS` 是不可编辑的 Secret，新代码不再读取它；生产发布无需新增合约地址变量。
5. Vercel 已连接免费 Upstash Redis 到 RoxMate 的 Production 和 Preview，并自动提供 `KV_REST_API_URL`、`KV_REST_API_TOKEN`。既有 `AI_API_KEY`、`AI_MATCH_URL`、`AI_MATCH_MODEL` 保留在服务端。缺少共享限流配置时只提供基础匹配。
6. PR #1 合并后，Vercel Production 部署成功，页面包含新合约地址。旧测试网用户需在新合约重新创建身份卡和成绩；搭档关系与评价从零开始。

日期：2026-09-04。

## 修复版链上结果

- 网络：Monad Testnet，Chain ID 10143。
- 合约：`0x2055a709102e37c11eec274e0f456e6d01ec13b8`。
- 部署账户：`0xfadB2e92e78A003a96318a6BD93AC0ad7eb5f97A`。
- 交易：`0x83723ef68975ca5991ae511e14cca967d23e73e6413a27bdc1c7586659db04bf`。
- 部署区块：66354550。
- 回执状态：成功（0x1）；Gas 4,602,235；实际费用：0.47361600385 测试 MON。
- 链上代码存在；`getPendingRequester` 返回零地址、`profileCount` 返回 0，符合新合约初始状态。浏览器源码验证尚未执行。

## 旧合约

- 地址：`0x601c5e9007e52950575b46b84415b152853685d0`，旧状态有 3 张身份卡，不会自动复制到新合约。
- 旧回执、区块和交易见 `contracts/deployments/10143-legacy.json`。

## 本机服务

- 不再需要 PostgreSQL；公开业务数据全部从合约读取。
- Web + 可选 AI Proxy：`http://localhost:3000`，配置文件 `apps/web/.env.local`。
- AI 模型：Moonshot API / Kimi K3（`AI_MATCH_URL=https://api.moonshot.cn/v1/chat/completions`，`AI_MATCH_MODEL=kimi-k3`）。`AI_API_KEY` 只放在服务端环境变量中，不要提交到仓库。
- AI 验证范围：当前记录的适配器测试使用本地模型桩，尚未记录 Kimi K3 的真实 API 调用验证。
- Web 是本次启动的开发进程，不保证电脑重启后自动恢复。

重启 Web：

```bash
cd /Users/mayjlee/Documents/Codex/Monad/apps/web
npm run dev
```

## 验证与边界

- 前端/API 类型检查通过。
- 本地页面返回 HTTP 200。
- 已验证身份、成绩、搭档和评价合约接口的 Foundry 测试；前端链上交易适配器已接入。
- GitHub `main` 合并提交 `ae8d13f0ac2df8df6658168c118f61e8f4fa0073` 已由 Vercel 部署到生产环境。生产网页实际下发的 JS 包含新地址、不包含旧地址；无效 `/api/ai` 请求返回 HTTP 400。
- AI 模型真实请求和双钱包端到端搭档确认尚未在新合约验证；需有用户在新合约创建身份卡后才能进行。
