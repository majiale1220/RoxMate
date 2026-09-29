# RoxMate

HYROX 运动身份与搭档发现应用，运行在 Monad Testnet。[在线体验](https://roxmate-one.vercel.app/)。

用户用钱包创建公开身份卡、发布本人自报的比赛成绩，并根据同城及可比较的项目成绩寻找搭档。邀请、接受和 GOOD / BAD 评价写入链上；双方授权时，可选的 Kimi K3 服务提供匹配解释。链上记录可核对交易来源，不代表赛事官方认证或现实合作已获核验。

## 当前功能

- 身份卡、已发布成绩、搭档关系及评价公开上链；草稿只保存在当前浏览器。
- 基础匹配按同城筛选，并比较相同组别、项目和工作量的成绩；AI 只补充解释，不调整分数。
- 搭档邀请由接收人接受或拒绝；接受后可对对方已发布成绩评价。链上写入需钱包确认并支付测试网 Gas。

网络：Monad Testnet（Chain ID `10143`）。当前合约：`0x2055a709102e37c11eec274e0f456e6d01ec13b8`。旧合约数据不会自动迁移；旧用户需重新创建身份卡和成绩。

## 本地运行

需要 Node.js 和 npm。从仓库根目录运行：

```bash
cd apps/web
npm ci
npm run dev
```

打开 `http://localhost:3000`。默认 RPC 和合约地址已内置；链上写入需要兼容的浏览器钱包及 Monad Testnet 测试币。

## 可选 AI 配置

参照 [`apps/web/.env.example`](apps/web/.env.example)，在 `apps/web/.env.local` 或 Vercel 服务端环境中配置 `AI_API_KEY`、`AI_MATCH_URL`、`AI_MATCH_MODEL`，以及 Upstash Redis REST 凭据：`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。Vercel Upstash 集成提供的 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 也可使用。密钥和令牌不要加 `NEXT_PUBLIC_` 前缀。缺少 AI 或 Redis 配置时，基础匹配仍可使用。

只有切换到另一份合约时才需设置 `NEXT_PUBLIC_ACTIVE_REGISTRY_ADDRESS`；`NEXT_PUBLIC_MONAD_TESTNET_RPC_URL` 可覆盖默认 RPC。

## 验证

从仓库根目录运行；合约测试另需 Foundry：

```bash
(cd apps/web && npm test && npm run lint && npm run build)
(cd contracts && forge test)
```

使用细节见 [操作指南](PERSONAL_WORKFLOW.md)；链上交易、旧合约与上线验证见 [部署记录](DEPLOYMENT.md)。
