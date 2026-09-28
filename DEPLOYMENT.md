# RoxMate 本机与 Monad Testnet 部署记录

**当前状态（2026-09-28）**：本文记录的合约地址是旧版部署，尚不包含邀请方向权限修复。合约不能原地升级；新版部署和前端地址切换完成前，前端会暂停旧合约上的邀请与评价交易。旧合约数据不会自动迁移。

## 修复版上线步骤

1. 在 `contracts` 目录运行 `forge test`，再用 `forge script script/Deploy.s.sol:DeployRoxMateRegistry --rpc-url "$MONAD_TESTNET_RPC_URL"` 模拟部署。2026-09-28 的模拟通过，按当时链上费率估算上限约 1.01 MON；实际费用以广播时钱包与 RPC 报价为准。
2. 确认部署账户和费用后，使用 Foundry 加密账户 `roxmate-deployer` 加 `--broadcast` 部署。记录交易哈希、区块和新地址，并验证新地址的 `getPendingRequester(address,address)` 可读。
3. 更新 `contracts/deployments/10143.json`、本地 `apps/web/.env.local` 和线上环境中的 `REGISTRY_ADDRESS`、`NEXT_PUBLIC_REGISTRY_ADDRESS`，然后重新构建和发布 Web。不要沿用旧地址；前端会对旧地址暂停搭档写入。
4. 如需 AI 解释，在服务端配置 `AI_API_KEY`、`AI_MATCH_URL`、`AI_MATCH_MODEL` 和 Redis REST 凭据。Vercel Upstash 集成自动提供 `KV_REST_API_URL`、`KV_REST_API_TOKEN`；直接配置 Upstash 时可用 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。缺少共享限流配置时只提供基础匹配。
5. 通知旧测试网用户重新创建身份卡和成绩。旧合约状态不会自动复制，新合约上的搭档关系和评价从零开始。

日期：2026-09-04。

## 链上结果

- 网络：Monad Testnet，Chain ID 10143。
- 合约：`0x601c5e9007e52950575b46b84415b152853685d0`。
- 部署账户：`0xfadB2e92e78A003a96318a6BD93AC0ad7eb5f97A`。
- 交易：`0x86375757703f190c663ce24c1f880a16fbcd951f15b5b3edb4423cbcd20e95cb`。
- 部署区块：59503976。
- 回执状态：成功（0x1）；实际费用：0.205752594001997598 MON。
- 已完成链上 `getIdentity` 只读调用；浏览器源码验证尚未执行。
- 临时 keystore 密码文件已删除，加密 keystore 保留。

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
- 新版本部署交易：`0x117a6721f8c0dfa6d92af0b0c2b7f719db36293e1c7a5ae9e46a462780765b42`，状态成功。
