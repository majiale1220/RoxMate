# RoxMate

**记录你的 HYROX 个人成绩，建立运动身份，找到合拍的训练搭档。**

RoxMate 是一个运行在 Monad Testnet 上的运动身份与搭档发现应用。用户通过钱包创建身份卡、发布本人自报的比赛成绩，再按城市、组别和可比较的项目成绩寻找潜在搭档。搭档邀请、接受状态和成绩评价由智能合约记录；AI 可在双方授权后补充匹配解释。

[打开 RoxMate](https://roxmate-one.vercel.app/) · [部署记录](DEPLOYMENT.md) · [操作指南](PERSONAL_WORKFLOW.md)

> 当前应用连接 Monad Testnet（Chain ID `10143`）。链上成绩为用户自报数据，不代表赛事官方认证；链上搭档关系和评价也不能证明现实中的合作已核验。

## 为什么建设 RoxMate

RoxMate 希望让 HYROX 爱好者把每场比赛中自己承担的项目整理成连续的运动履历，并在寻找搭档时获得更具体的判断依据。仅看比赛总用时，很难了解一个人在各个站点的表现；不同组别、距离、负重和次数的成绩，也需要在一致的条件下比较。

项目围绕三个目标展开：

- **积累个人运动履历**：将身份卡与多场比赛记录关联到同一个钱包，展示本人完成的项目、用时及工作量，让成绩成为可以持续查看的个人记录。
- **提供有依据的搭档发现**：从同城用户出发，只比较相同组别、项目和已知工作量的成绩，用可比记录和匹配理由帮助用户判断是否适合一起训练或参赛。
- **记录双方认可的搭档关系**：通过邀请与接收方确认建立关系，再由已成为搭档的用户评价具体成绩，让关系状态、评价来源和提交过程可以核对。

当前产品把这些目标落实为“身份卡 → 个人成绩 → 搭档匹配 → 邀请确认 → 成绩评价”的完整流程。

## 为什么选择 Monad

RoxMate 将身份、已发布成绩、搭档关系和评价保存为公开的合约状态。用户用钱包提交记录，合约检查邀请方向和评价权限，其他人也可以通过链上记录核对发布者与操作来源。这为运动履历和社交互动提供了共同的数据依据。

选择 Monad，主要考虑以下几点：

- **兼容现有 EVM 工具**：Monad 保持 EVM 字节码和 Ethereum RPC 兼容，项目可以使用 Solidity、Foundry、OpenZeppelin、viem 和浏览器钱包完成开发与交互。这与仓库当前采用的技术栈直接对应。[Monad 官方文档](https://docs.monad.xyz/)
- **适合多用户的日常互动**：Monad 通过并行执行和异步执行提升处理能力，并提供快速确认。RoxMate 的身份更新、成绩发布、邀请响应和评价都是独立的用户操作，选择这一架构是为了支持这些互动随用户规模增长。[Monad 架构说明](https://docs.monad.xyz/)
- **可以验证完整的链上流程**：当前 Registry 已部署在 Monad Testnet，Web 应用直接读取合约并由用户钱包发起交易。项目能在测试网上实际验证身份创建、成绩发布、邀请权限和评价规则。

链上记录提供的是来源和操作过程的可核对性。成绩内容仍由用户自行填写，其真实性需要结合赛事记录和现实交流判断。

## AI 如何与链上数据结合

RoxMate 的 AI 围绕搭档发现这一具体任务工作。基础匹配先按同城、相同组别和相同工作量计算可比成绩及用时相似度，AI 再把这些已计算的信号转成简洁的中文匹配解释，帮助用户理解候选人为何出现在结果中。

当前实现包含以下流程：

1. **读取链上记录**：从 Registry 获取身份卡与已发布成绩，生成基础匹配分和理由。
2. **核验双方授权**：请求方为本次 AI 请求签名，服务端验证签名，并检查请求方与候选人的链上 AI 授权状态。
3. **重新计算匹配信号**：服务端从合约重新计算结果，再向配置的 AI 服务发送匿名序号、分数、可比记录数量和匹配理由。
4. **展示补充解释**：AI 输出作为候选人的文字说明展示，基础分数和排序保持由匹配规则决定。模型、授权或调用限额不满足条件时，应用继续展示基础匹配。

链上数据为匹配提供可读取的记录和授权状态，规则计算提供一致的比较依据，AI 提供易读的解释。三者共同服务于用户最终的搭档选择。实现见 [`chain-service.ts`](apps/web/lib/chain-service.ts) 与 [`/api/ai`](apps/web/app/api/ai/route.ts)。

## 特色方向与赛道契合

根据当前产品与代码实现，RoxMate 的特色可以从以下应用方向展示：

| 方向 | 项目中的具体实现 | 对应的应用价值 |
| --- | --- | --- |
| **AI + Web3** | 链上授权、钱包签名、服务端重算匹配信号、匿名摘要生成 AI 解释 | 将 AI 解释接入有明确数据来源与授权流程的搭档发现任务 |
| **消费级应用（Consumer App）** | 创建身份卡、记录比赛、找同城搭档、邀请与评价 | 用运动爱好者可以直接操作的流程连接链上功能与日常需求 |
| **链上社交与身份** | 钱包关联身份和成绩履历，双方确认搭档关系，合约限制评价权限 | 让个人履历、社交关系与评价来源可以公开核对 |
| **运动科技（SportsTech）** | HYROX 八项站点成绩、组别及距离／负重／次数记录，按一致条件比较表现 | 为运动搭档选择提供比单一总用时更具体的参考 |

## 功能一览

- **运动身份卡**：用钱包创建公开身份，填写昵称、城市和个人介绍，并选择是否加入应用内推荐及是否授权 AI 匹配。
- **个人比赛记录**：记录 HYROX 组别、赛事信息及本人承担的八项站点成绩。总用时、跑步配速和项目工作量可选；未记录的项目可以留空。
- **本地草稿**：未发布的成绩草稿保存在当前浏览器的 `localStorage`，按钱包分别保存。草稿不会写入链上，也不会自动同步到其他设备。
- **基础搭档匹配**：先筛选同城用户，再比较双方最近最多五场成绩中的相同组别、相同项目和相同工作量记录。每批最多检查十个身份位置，可以继续查看更早加入的用户。
- **AI 匹配解释**：双方都开启授权且请求方签名后，服务端才会请求 AI 生成解释。AI 只补充文字，不改变基础分数和排序；AI 不可用时仍可使用基础匹配。
- **搭档邀请与评价**：接收方可以接受或拒绝邀请。双方成为搭档后，可以查看彼此已发布的成绩，并对每条成绩提交一次 `GOOD` 或 `BAD` 评价及可选说明。
- **链上核对**：身份卡、已发布成绩、搭档状态和评价保存在公开链上，可从交易记录核对来源。

## 使用流程

1. 在支持 EVM 的浏览器钱包中切换到 Monad Testnet，连接钱包。
2. 创建身份卡，填写昵称和城市；是否参与推荐、是否启用 AI 匹配由你选择。
3. 发布个人比赛成绩，或先保存为仅当前浏览器可见的草稿。
4. 在“AI 找搭子”查看同城用户及基础成绩匹配；授权双方均开启时，可以请求 AI 补充解释。
5. 向感兴趣的用户发出邀请。对方接受后，你们即可查看彼此成绩并提交评价。

链上写入需要钱包确认并支付 Monad Testnet Gas。新合约不会自动迁移旧合约上的身份卡和成绩；旧用户需要重新创建身份卡并重新发布希望保留的成绩。

## 数据与授权说明

- 钱包地址、身份卡、已发布成绩、搭档状态和评价都是公开链上数据。关闭“允许在应用内被推荐”只会让你不出现在应用匹配结果中，不会隐藏链上数据。
- 已发布成绩不可覆盖修改，评价提交后不可修改。请在确认内容无误后再发起链上交易。
- 草稿只保存在当前浏览器；清除浏览器数据会删除草稿。
- AI 服务只接收匿名序号、基础匹配分、可比较记录数量及匹配理由，不接收候选人的钱包地址、昵称或个人介绍。请求方钱包地址用于服务端核验签名和链上授权。
- AI 请求需配置 Redis 防重放和限额：每个钱包每小时最多三次，全站每天最多一百次。缺少 AI 或 Redis 配置时，基础匹配仍可使用。

## 在线部署

- **应用**：[roxmate-one.vercel.app](https://roxmate-one.vercel.app/)
- **网络**：Monad Testnet，Chain ID `10143`
- **当前合约**：[`0x2055a709102e37c11eec274e0f456e6d01ec13b8`](https://testnet.monadscan.com/address/0x2055a709102e37c11eec274e0f456e6d01ec13b8)
- **部署交易**：[`0x83723ef68975ca5991ae511e14cca967d23e73e6413a27bdc1c7586659db04bf`](https://testnet.monadscan.com/tx/0x83723ef68975ca5991ae511e14cca967d23e73e6413a27bdc1c7586659db04bf)

地址和交易明细见 [`contracts/deployments/10143.json`](contracts/deployments/10143.json)，上线与验证记录见 [DEPLOYMENT.md](DEPLOYMENT.md)。旧合约资料见 [`contracts/deployments/10143-legacy.json`](contracts/deployments/10143-legacy.json)。

## 本地运行

### 环境要求

- Node.js（建议使用当前维护中的 LTS 版本）和 npm
- 用于链上交互的浏览器钱包；本地查看页面不要求先连接钱包
- 如需运行合约测试：Foundry（`forge`）

### 启动 Web 应用

```bash
cd apps/web
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。默认 Monad Testnet RPC 和当前合约地址已配置在应用中。要创建身份、发布成绩或写入评价，请在钱包中切换到 Monad Testnet 并准备测试网 MON。

### 配置环境变量

复制 `apps/web/.env.example` 为 `apps/web/.env.local`，按需填写：

| 变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `NEXT_PUBLIC_MONAD_TESTNET_RPC_URL` | 覆盖默认 Monad Testnet RPC 地址 | 否 |
| `NEXT_PUBLIC_ACTIVE_REGISTRY_ADDRESS` | 指定另一份 Registry 合约；默认使用当前部署地址 | 否 |
| `AI_API_KEY` | 服务端调用 AI 服务的密钥 | 使用 AI 时必需 |
| `AI_MATCH_URL` | AI 兼容接口地址，默认 Moonshot API | 使用 AI 时必需 |
| `AI_MATCH_MODEL` | AI 模型名称，默认 `kimi-k3` | 使用 AI 时必需 |
| `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | AI 请求防重放与调用限额 | 使用 AI 时必需 |

Vercel 的 Upstash 集成也可以提供 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 替代 `UPSTASH_REDIS_REST_*`。AI 密钥和 Redis 令牌只能放在服务端环境变量中，不要添加 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。

未配置 AI 或 Redis 时，应用继续提供基础匹配；配置了 AI 密钥但没有可用的 Redis 凭据时，AI 接口不会启用。

## 开发与验证

Web 项目位于 `apps/web`，智能合约位于 `contracts`。从仓库根目录运行：

```bash
(cd apps/web && npm test)
(cd apps/web && npm run lint)   # 当前脚本执行 TypeScript 类型检查
(cd apps/web && npm run build)
(cd contracts && forge test)
```

## 技术栈

- **Web**：Next.js 15、React 19、TypeScript
- **钱包与链交互**：viem、EIP-1193 浏览器钱包接口
- **智能合约**：Solidity 0.8.28、Foundry、OpenZeppelin Contracts
- **AI 服务端接口**：Next.js Route Handler、钱包签名验证、Upstash Redis 限额
- **部署**：Vercel（Web）；Monad Testnet（Registry 合约）

## 仓库结构

```text
apps/
  web/
    app/          Next.js 页面、样式与 AI API
    components/   身份卡、成绩、搭档等界面组件
    lib/          钱包、合约交互、匹配和 AI 授权逻辑
    tests/        Web 端测试
contracts/
  src/            RoxMateRegistry 智能合约
  deployments/    Monad Testnet 当前及旧版部署记录
  test/           Foundry 合约测试
DEPLOYMENT.md     部署及上线验证记录
PERSONAL_WORKFLOW.md  详细用户操作指南
```

## 更多文档

- [操作指南](PERSONAL_WORKFLOW.md)：身份卡、成绩、匹配、AI 授权和评价的详细规则。
- [部署记录](DEPLOYMENT.md)：当前与旧合约、部署交易、生产环境配置及已完成的验证。
