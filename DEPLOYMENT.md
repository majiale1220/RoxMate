# RoxMate 部署记录

2026-09-28，当前合约部署于 Monad Testnet（Chain ID `10143`），Web 已发布到 [roxmate-one.vercel.app](https://roxmate-one.vercel.app/)。

| 项目 | 记录 |
| --- | --- |
| 合约 | `0x2055a709102e37c11eec274e0f456e6d01ec13b8` |
| 部署交易 | `0x83723ef68975ca5991ae511e14cca967d23e73e6413a27bdc1c7586659db04bf` |
| 部署区块 | `66354550` |
| 部署账户 | `0xfadB2e92e78A003a96318a6BD93AC0ad7eb5f97A` |
| 回执 | 成功；Gas 4,602,235；费用 0.47361600385 测试 MON |

详细交易数据见 [`contracts/deployments/10143.json`](contracts/deployments/10143.json)。已确认链上代码存在，`getPendingRequester` 返回零地址、`profileCount` 返回 0，符合新合约初始状态。浏览器源码验证尚未完成。

## 旧合约与数据

旧地址 `0x601c5e9007e52950575b46b84415b152853685d0` 曾有 3 张身份卡；状态不会自动迁移。用户需要在新合约重新创建身份卡和成绩，搭档关系与评价重新开始。[旧部署记录](contracts/deployments/10143-legacy.json)仍保留供核对。

## Web 配置与验证

新合约地址内置于 `apps/web/lib/chain.ts`。Vercel 中旧的 `NEXT_PUBLIC_REGISTRY_ADDRESS` 已被忽略，无需为当前合约新增地址变量。Production 和 Preview 已连接 Upstash Redis，提供 `KV_REST_API_URL`、`KV_REST_API_TOKEN`；AI 密钥及模型配置仅在服务端使用。

上线前 `forge test` 8 项、`npm test` 15 项、类型检查与生产构建通过。生产网页曾核对包含新合约地址，错误格式的 `/api/ai` 请求返回 HTTP 400。真实 Kimi API 调用与双钱包端到端搭档确认尚未记录验证结果。
