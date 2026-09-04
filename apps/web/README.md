# RoxMate Web

钱包地址身份、个人身份卡、多场比赛成绩、前端匹配和可选 DeepSeek 解释。

本地启动：

```bash
cd apps/web
npm install
npm run dev
```

无需创建 PostgreSQL 数据库或配置会话密钥。参照 `.env.example` 配置 Monad RPC、`REGISTRY_ADDRESS` 和 `NEXT_PUBLIC_REGISTRY_ADDRESS`；AI 配置为可选项。身份卡、成绩、搭档与评价由钱包直接写入合约，页面通过 RPC 直接读取。
打开 http://localhost:3000，使用安装钱包扩展的浏览器连接钱包。

详细业务规则、DeepSeek 配置和验证命令见 [个人业务流程与操作指南](../../PERSONAL_WORKFLOW.md)。
