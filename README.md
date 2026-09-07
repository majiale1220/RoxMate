# RoxMate

> **YOUR OWN RECORD. YOUR NEXT PARTNER.**

**HYROX × Monad 的链上运动身份与搭档发现平台。**

RoxMate 把分散的比赛成绩变成可携带、可验证的运动身份，并帮助运动者找到真正合拍的下一位搭档。它将运动员身份、比赛成绩和搭档关系组织成开放的链上社交图谱，让用户的运动贡献和协作关系拥有更清晰的归属。

产品通过城市、组别和项目表现重新组织“找搭子”时的注意力：规则引擎先筛选真正可比较的候选人，再由 Kimi K3 根据匿名匹配信号解释“为什么适合一起训练或参赛”。搭档确认与 GOOD / BAD 评价继续把一次合作沉淀为社区信任和协作文化。

<p>
  <a href="https://roxmate-one.vercel.app/">🚀 在线体验</a> ·
  Monad Testnet · Chain ID <code>10143</code>
</p>

## 为什么是 RoxMate？

HYROX 的成绩不只是一个最终用时。搭档是否合拍，还取决于每个项目的节奏、力量分配和协作体验。RoxMate 让链上事实、规则匹配和 Kimi K3 的自然语言解释协同工作，让“找搭子”从凭感觉变成基于真实表现、可解释且可持续的社区协作。

## 核心体验

- **建立运动身份**：钱包地址就是身份入口，创建公开的运动员名片。
- **记录个人履历**：记录 HYROX 8 个项目、比赛日期、组别、用时及负重/次数等信息。
- **发现合拍搭档**：基于城市、组别和可比较的项目表现筛选候选人，并提供匹配分数。
- **确认真实关系**：搭档邀请、接受和关系状态写入 Monad Testnet，双方共享同一份事实。
- **留下搭档评价**：完成合作后，对已发布成绩留下 GOOD / BAD 反馈，积累可参考的协作信号。
- **Kimi K3 匹配解释**：Kimi K3 只接收匿名的可比成绩摘要，用于解释匹配原因，不发送钱包、昵称或个人介绍。

## 产品流程

```text
连接钱包 → 创建运动身份 → 记录比赛成绩 → 找到匹配搭档 → 确认搭档关系 → 互相评价
```

## 产品预览

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/identity-desktop.png" alt="RoxMate 运动身份卡" /></td>
    <td width="50%"><img src="docs/screenshots/record-desktop.png" alt="RoxMate 比赛成绩录入" /></td>
  </tr>
  <tr>
    <td align="center">运动身份卡 · Personal Records</td>
    <td align="center">比赛成绩录入 · Log Result</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/matches-mobile.png" alt="RoxMate 移动端找搭子" /></td>
    <td width="50%"><img src="docs/screenshots/partner-review-mobile.jpg" alt="RoxMate 移动端搭档评价" /></td>
  </tr>
  <tr>
    <td align="center">找搭子 · Find Mate</td>
    <td align="center">搭档评价 · Partner Review</td>
  </tr>
</table>

## 为什么使用 Monad？

RoxMate 将运动身份、比赛成绩、搭档关系和评价记录在 Monad Testnet 上，形成公开、可验证且不依赖单一平台数据库的运动履历。用户保有自己的钱包和写入权，产品只负责提供更好的记录、发现和协作体验。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Web | Next.js 15 · React 19 · TypeScript |
| Wallet | viem |
| Smart contract | Solidity · OpenZeppelin · Foundry |
| Network | Monad Testnet · Chain ID `10143` |
| Matching | 浏览器端规则匹配 + Kimi K3 匹配解释 |

Registry 合约：`0x601c5e9007e52950575b46b84415b152853685d0`

## Demo & Submission

- **Live Demo**：[roxmate-one.vercel.app](https://roxmate-one.vercel.app/)
- **Network**：Monad Testnet
- **Tracks**：社会、注意力和文化 · KIMI / Kimi K3
- **AI Model**：Kimi K3
- **状态**：MVP / Hackathon prototype

线上 Demo 主要用于展示产品体验；连接钱包和链上写入需要兼容的钱包以及 Monad Testnet 测试币。

## 下一步

- 完善双钱包端到端的搭档确认体验
- 增加更丰富的成绩趋势、分页和通知能力
- 支持更多赛事类型与训练数据来源
- 进一步完善移动端交互和生产环境监控
