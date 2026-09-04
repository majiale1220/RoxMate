# RoxMate

> **YOUR OWN RECORD. YOUR NEXT PARTNER.**

RoxMate 是一个面向 HYROX 社区的链上运动身份与搭档匹配 MVP。它把每一场比赛成绩沉淀为可验证的个人履历，再用同城、组别和真实表现帮助运动者找到更合拍的搭档。

用户连接钱包后，以钱包地址作为运动身份，创建公开身份卡，记录个人成绩，浏览匹配候选人，并在完成搭档关系后留下 GOOD / BAD 评价。公开业务事实写入 Monad Testnet，未发布的成绩草稿仅保存在本地浏览器。

| 在线体验 | 网络 | 合约 |
| --- | --- | --- |
| [roxmate-one.vercel.app](https://roxmate-one.vercel.app/) | Monad Testnet · Chain ID `10143` | `0x601c5e9007e52950575b46b84415b152853685d0` |

## 产品截图

以下截图展示 RoxMate 的核心使用路径：查看运动身份、录入比赛成绩、寻找匹配搭档，以及在移动端查看搭档评价。

<table>
  <tr>
    <td width="50%"><img src="qa/2026-09-04/desktop-identity.png" alt="RoxMate 运动身份卡" /></td>
    <td width="50%"><img src="qa/2026-09-04/desktop-record.png" alt="RoxMate 比赛成绩录入" /></td>
  </tr>
  <tr>
    <td align="center">运动身份卡 · Personal Records</td>
    <td align="center">比赛成绩录入 · Log Result</td>
  </tr>
  <tr>
    <td width="50%"><img src="qa/2026-09-04/mobile-matches.png" alt="RoxMate 移动端找搭子" /></td>
    <td width="50%"><img src="qa/personal-workflow/partner-review-mobile.jpg" alt="RoxMate 移动端搭档评价" /></td>
  </tr>
  <tr>
    <td align="center">找搭子 · Find Mate</td>
    <td align="center">搭档评价 · Partner Review</td>
  </tr>
</table>

> 截图来自项目验收素材；线上首页可直接访问，钱包连接和链上写入操作需要使用 Monad Testnet 钱包并由用户确认交易。

## 功能特性

- **钱包地址身份**：不使用服务端登录或数据库会话；钱包地址就是用户身份，写入链上时由钱包签名授权。
- **链上运动身份卡**：昵称、城市、个人介绍、公开设置和 AI 授权状态由用户钱包写入 Monad Testnet。
- **个人成绩履历**：支持 8 个 HYROX 项目、比赛日期、组别、个人用时、距离、负重、次数、总用时和跑步配速。
- **本地草稿**：未完成的成绩保存在浏览器本地，并按钱包地址隔离；已发布成绩不可覆盖修改。
- **表现驱动匹配**：从公开且允许推荐的用户中进行有边界的读取，只比较同城、同组别、同工作量项目，避免全量扫描。
- **搭档关系**：支持发送邀请、接受/拒绝邀请，并通过链上状态确认关系。
- **搭档评价**：已建立关系的双方可对已发布成绩提交一次 GOOD/BAD 评价和补充说明。
- **隐私边界**：不收集联系方式和精确训练时间；AI 只接收匿名的可比成绩摘要，钱包、昵称、地点和个人介绍不发送给 AI 服务。

## 产品流程

```text
连接钱包
    ↓
创建运动身份卡
    ↓
记录成绩并保存草稿
    ↓
发布个人比赛成绩
    ↓
基础规则 / AI 匹配
    ↓
查看身份与成绩并发送邀请
    ↓
对方接受邀请成为搭档
    ↓
互相评价已发布成绩
```

## 技术架构

| 模块 | 技术 | 职责 |
| --- | --- | --- |
| Web | Next.js 15、React 19、TypeScript | 页面、钱包连接、表单和交互状态 |
| Wallet | viem | 钱包发现、链切换、链上读取和交易确认 |
| Matching | 浏览器端 TypeScript | 直接读取链上候选人，在本地计算基础匹配 |
| AI Proxy | Next.js Route Handler | 无状态转发匿名匹配信号，服务端保管 AI Key |
| Contract | Solidity 0.8.28、OpenZeppelin、Foundry | 身份卡、成绩、搭档关系和评价的链上事实 |
| Network | Monad Testnet，Chain ID 10143 | 公开链上数据和用户交易 |
| Storage | Browser localStorage | 仅保存未发布的个人草稿，不使用业务数据库 |

个人页面的身份、成绩、搭档关系和评价都直接从 Monad RPC 读取，写入操作由用户钱包直接发起并支付 Gas。服务端不持有用户资产私钥；唯一保留的 API Route 是可选的无状态 AI 代理，避免将 AI Key 暴露给浏览器。

## 项目结构

```text
apps/web/
├── app/                    # Next.js 页面与 API 路由
├── components/             # 通用 UI、成绩和搭档组件
└── lib/                    # 钱包、合约交互、链上读取和前端匹配
contracts/
├── src/RoxMateRegistry.sol # RoxMateRegistry 合约
└── test/                   # Foundry 合约测试
qa/                         # 验收报告、截图和测试证据
scripts/                   # 本地环境配置脚本
```

## 本地运行

```bash
node scripts/configure-local.mjs
cd apps/web
npm install
npm run dev
```

打开 <http://localhost:3000>，使用安装钱包扩展的浏览器或钱包内置浏览器访问。环境变量模板见 [`apps/web/.env.example`](apps/web/.env.example)。AI 配置为可选项，未配置时使用前端基础匹配。

## 测试与构建

```bash
# Web 类型检查与生产构建
cd apps/web
npm run lint
npm run build

# 合约测试与格式检查
cd ../../contracts
forge test
forge fmt --check
```

当前验收记录见 [`qa/2026-09-04/功能验收报告.md`](qa/2026-09-04/功能验收报告.md)。

## Monad Testnet 部署

- Chain ID：`10143`
- Registry：`0x601c5e9007e52950575b46b84415b152853685d0`
- RPC：<https://testnet-rpc.monad.xyz/>

合约源码近期增加了输入长度限制和重复邀请修复；如需让这些源码变更在测试网上生效，需要重新部署并更新 `REGISTRY_ADDRESS` 与 `NEXT_PUBLIC_REGISTRY_ADDRESS`。当前 README 中的地址保持为现有部署地址。

## 当前定位与后续方向

RoxMate 当前是面向个人运动履历和搭档发现的 MVP，不代表官方赛事认证，也不构成体育成绩裁判。后续可扩展：真实钱包双用户端到端测试、关系方向 getter、完整分页、WalletConnect、生产级限流与监控，以及更多运动项目。
