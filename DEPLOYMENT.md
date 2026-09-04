# RoxMate 本机与 Monad Testnet 部署记录

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
