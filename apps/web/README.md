# RoxMate Web

钱包地址身份、个人身份卡、多场比赛成绩、前端匹配和可选 Kimi K3 匹配解释。

本地启动：

```bash
cd apps/web
npm install
npm run dev
```

无需创建 PostgreSQL 数据库或配置会话密钥。当前 Monad Testnet 合约地址已内置于 `lib/chain.ts`；参照 `.env.example` 可选配置 RPC，切换到其他合约时才需设置 `NEXT_PUBLIC_ACTIVE_REGISTRY_ADDRESS`。Vercel 上旧的 `NEXT_PUBLIC_REGISTRY_ADDRESS` 不再被读取。身份卡、成绩、搭档与评价由钱包直接写入合约，页面通过 RPC 直接读取。

AI 解释可选：同时配置 `AI_API_KEY`、`AI_MATCH_URL`、`AI_MATCH_MODEL` 和 Upstash Redis REST 凭据。Vercel 的 Upstash 集成自动提供 `KV_REST_API_URL`、`KV_REST_API_TOKEN`；直接配置 Upstash 时可用 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。AI 请求需要当前钱包签名；服务端从链上重新计算匹配信号，并用 Redis 原子检查请求 nonce、每钱包每小时 3 次和全站每日 100 次的额度。缺少限流存储时，AI 解释关闭，基础匹配仍可用。Redis REST 接口使用服务端环境变量，不能加 `NEXT_PUBLIC_` 前缀。

搭档邀请和评价需要连接含 `getPendingRequester` 的修复版合约。旧合约上的这几类交易会被前端阻止；旧链上数据不会自动迁移。
打开 http://localhost:3000，使用安装钱包扩展的浏览器连接钱包。

详细业务规则、Kimi K3 配置和验证命令见 [个人业务流程与操作指南](../../PERSONAL_WORKFLOW.md)。
