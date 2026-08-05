# Money Split

一个面向小团队和朋友出行的多人分账工具，支持多币种账单、自定义分摊、实时清算和还款记录。

线上版本：[multi-party-expense-splitter.vercel.app](https://multi-party-expense-splitter.vercel.app)

## 功能

- 自定义成员，无预设姓名
- 均分与自定义分摊
- 每笔账单独立选择 TWD、HKD 或 CNY
- TWD/HKD 金额提供人民币参考换算
- 账单新增、编辑、删除与撤回上一笔
- 实时净头寸和最简转账路径
- 从结算路径一键预填还款记录
- 内部转账不计入总支出
- 手机端布局、键盘避让和安全区域适配
- Vercel Functions + Neon Postgres 持久化
- API 不可用时回退到浏览器 localStorage

## 技术栈

- React 18（通过浏览器 ESM import map 加载）
- htm 模板，不使用 JSX 编译
- Tailwind CSS
- Vercel Functions
- Neon Postgres
- Node.js 内置测试运行器

项目没有 Vite 或其他 JavaScript 打包步骤。Tailwind 会将 `src/styles.css` 编译到 `dist/styles.css`。

## 本地运行

需要 Node.js 22 或兼容版本。

```bash
npm install
npm run build
npm run dev
```

打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。普通静态服务器不会运行 `/api`，因此本地页面会自动使用 localStorage。

## 测试

```bash
npm test
npm run build
```

GitHub Actions 会在推送和 Pull Request 时执行同样的检查。

## 数据库与部署

项目使用两个彼此独立的 Neon 数据库：

- Vercel `Production` 使用正式数据库，当前数据库名为 `neondb`。
- Vercel `Preview` 和 `Development` 使用测试数据库 `money_split_test`。

`src/server/databaseIsolation.js` 会在 API 建立连接前校验上述规则。生产环境无法连接测试库，预览和开发环境也无法连接正式库。修改数据库环境变量后，应分别重新部署对应环境，已有部署不会自动更新。

1. 在 Neon 创建正式数据库和测试数据库。
2. 在 Vercel 中为 Production 单独配置正式库的 `DATABASE_URL`。
3. 为 Preview 和 Development 单独配置测试库的 `DATABASE_URL`。
4. 将仓库导入 Vercel，或使用 Vercel CLI 部署。

```bash
npx vercel deploy --prod
```

后端也兼容 `POSTGRES_URL`、`POSTGRES_PRISMA_URL` 和 `NEON_DATABASE_URL`。数据库表会在首次 API 请求时自动创建。

需要在本机调试 Vercel Functions 时，只拉取 Development 环境，避免误连生产库：

```bash
npx vercel env pull .env.local --environment=development --yes
```

环境变量名称见 [`.env.example`](./.env.example)。不要提交真实数据库凭据或 `.env.local`。

## 项目结构

```text
api/                    Vercel Functions 与数据库访问
src/components/         页面组件
src/config/             应用常量
src/server/             服务端请求校验与数据映射
src/services/           浏览器 API 客户端
src/utils/              分账、币种和状态算法
src/__tests__/          Node.js 测试
dist/styles.css         编译后的 Tailwind CSS
```

更详细的维护说明见 [`agent.md`](./agent.md)。

## 当前限制

- 当前没有登录或账本权限隔离，获得生产网址的人可以修改共享数据。
- 部署环境已经隔离数据库，但同一个生产网址内仍是所有使用者共享同一本账。
- 汇率是应用内固定参考值，不是实时金融报价。
- 成员名称目前作为数据库主键，不支持直接重命名或删除已被历史账单引用的成员。
