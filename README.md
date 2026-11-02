# Game-Intention User Study

双语视频意图标注质量问卷，独立工程。阿里云 ESA 托管 React 页面与同源 API 入口，Supabase Edge Function 执行答题服务，原 Supabase PostgreSQL 保存回答，腾讯云 COS 提供视频。前端沿用同一个 React 组件，后端沿用同一套验证、事务及统计代码。

## 部署至阿里云 ESA

ESA 项目已通过 GitHub 连接到 `YuiLu/gameintent-survey` 的 `main` 分支。仓库的 `esa.jsonc` 指定安装 `npm ci`、构建 `npm run build:esa`、静态目录 `dist-esa`、边缘函数入口 `esa/worker.mjs`。Node 22 用于构建，不把 `.next` 当静态文件上传。依赖锁文件使用 npm 官方源，并保留完整性校验。

请求路径为：浏览器 → ESA `/api/*` → Supabase `survey-api` → 原 `survey` 数据库。ESA 不运行 PostgreSQL TCP 客户端；Supabase 函数保留数据库事务、行锁及唯一约束。网页和数据库均不需要重建题目或清空已有记录。

### 1. Supabase 答题函数

先在本机登录官方 CLI，再生成和部署函数：

```sh
npx supabase@3.0.0 login
npm run build:esa
npm run test:deno  # 已安装 Deno 时，检查实际 Supabase 部署包
npx supabase@3.0.0 functions deploy survey-api --remote=mtcfejthbrpgfqbtvuws --use-api
```

本机 `supabase/config.toml` 保持 `verify_jwt = true`；不要加 `--no-verify-jwt`。构建生成的 `supabase/functions/survey-api/index.mjs` 是部署包，不提交 Git。安装 Deno 后可直接运行部署包检查运行时。

进入 Supabase → Edge Functions → Secrets，填写：

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | 可选；默认使用该项目函数自带的 `SUPABASE_DB_URL`。需要覆盖时填之前已验证可用的完整 Transaction pooler URI |
| `STUDY_ADMIN_KEY` | 之前的管理密钥 |
| `STUDY_INITIAL_POOL` | `1`，只初始化空题库 |
| `STUDY_GATEWAY_KEY` | 新生成至少 64 位十六进制随机串，在 ESA 填写相同值 |

`STUDY_GATEWAY_KEY` 可在本机通过 `openssl rand -hex 32` 生成，自行安全保存，不发送到聊天或提交 Git。数据库内置官方 Supabase 根证书，仍严格校验 TLS。无需执行建表脚本，既有十张表和 RLS 保持原状。不要把 `survey` 加入 Data API 的公开 schema。

### 2. ESA 函数变量

ESA → 函数和 Pages → `gameintent-survey` → 基本信息 → 函数变量 → 生产环境：

| 变量 | 值 |
|---|---|
| `STUDY_API_URL` | `https://mtcfejthbrpgfqbtvuws.supabase.co/functions/v1/survey-api` |
| `SUPABASE_ANON_KEY` | Supabase 项目设置 → API Keys → Legacy API keys 中的 `anon` JWT；不要用 `service_role`，不要用 `sb_publishable_…` 替代 |
| `STUDY_GATEWAY_KEY` | 与 Supabase Secrets 完全相同，勾选加密存储 |

三个变量都只用于 ESA 函数，不添加 `NEXT_PUBLIC_` 前缀。ESA 不需要保存数据库密码、管理密钥或 COS 密钥。API 转发经过短时有效的 HMAC 签名，Supabase 另外保留平台 JWT 校验。浏览器的参与者 Cookie 和后台认证在签名信封中传递，Supabase URL 不充当受试者会话域名。

保存变量后重新构建并发布生产版本，变量才会进入新版本。先检查首页、`/api/config` 的真实数据库读取、演示视频、后台未登录 401、未分配视频 403，再绑定正式域名。单独检查 `/api/health` 不足以证明回收正常。正式问卷继续保持 `draft`，不写入测试回答。

### 3. 域名与视频

ESA → 本项目 → 域名 → 添加 `gameintent-survey.magic-lab.tech`，在阿里云 DNS 使用 ESA 实际返回的验证/CNAME 记录。不要沿用旧 Sites 或 EdgeOne 的 CNAME；新站验收前保留原部署。页面和 API 使用同一域名。

COS、视频域名及上传脚本沿用下文配置；五项 COS 运行变量填在 **Supabase Edge Functions Secrets**。演示视频在 ESA 静态目录，正式视频使用私有 COS 签名地址。`/api/*`、带身份 Cookie 的响应和媒体签名跳转不设置公共缓存。

## 原 Node 部署的兼容配置

`npm run build` / `npm run start` 继续支持标准 Node.js 部署。原 `edgeone.json` 保留供原站运行，ESA 使用单独的 `esa.jsonc`，两套构建产物互不混用。

以下建库说明仅用于全新环境；当前项目已经初始化，无需重跑。

1. Supabase 项目 `gameintent-survey` 已创建，项目引用 `mtcfejthbrpgfqbtvuws`。进入 SQL Editor，执行 [supabase/001_schema.sql](supabase/001_schema.sql)，可重复执行，保留已有数据；已有列结构不兼容时会报出具体字段。
2. Supabase 顶部 Connect → Transaction pooler，复制完整 PostgreSQL URI，替换密码并对密码中的特殊字符做 URL 编码。连接端口为 6543；主机名从控制台复制，不要根据项目 URL 猜测。免费版无需购买 IPv4 插件。
3. 本地或标准 Node.js 服务使用下表环境变量；ESA 部署按上文分开设置。预览与生产使用不同数据库，避免试答进入正式研究，不给任意 Git 分支注入正式凭证。

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** URI，只填服务端环境变量 |
| `DATABASE_CA_CERT` | 可选；已内置 Supabase Database Settings 链接提供的官方公开根证书，仅对 Supabase 数据库主机生效。此变量用于额外覆盖，不关闭证书校验 |
| `STUDY_ADMIN_KEY` | 自行生成随机管理密钥，例如本机执行 `openssl rand -hex 32`；自行安全保存 |
| `STUDY_INITIAL_POOL` | `1`；空库首次读取配置时初始化 484 条候选题目，不覆盖已有题目 |

不要添加 `NEXT_PUBLIC_` 前缀。无需 Supabase anon key 或 service_role key，浏览器不能直写数据库。数据库连接池每个函数实例一条连接，关闭命名预编译与流水线；批量操作在事务中执行。答题名额通过行锁与唯一约束分配。

Supabase 使用独立 `survey` schema，启用 RLS、不添加匿名策略，不将该 schema 加入 Data API 的 Exposed schemas。迁移脚本不删表；正式版本更新应新增迁移，建表脚本可以安全重跑补齐缺失表，但不能代替后续版本的结构迁移。当前连接使用项目数据库身份，数据库密码需只对研究负责人及服务端可见。

### 视频配置

COS 视频上传和媒体清单核对完成后，同时填写全部五项：

| 变量 | 值 |
|---|---|
| `COS_BUCKET` | `gameintent-survey-1321360347` |
| `COS_REGION` | `ap-shanghai` |
| `COS_MEDIA_ORIGIN` | `https://gameintent-media.magic-lab.tech` |
| `COS_SECRET_ID` | 仅有选中视频前缀 GetObject/HeadObject 权限的 CAM 身份 |
| `COS_SECRET_KEY` | 对应密钥，仅放服务端环境变量 |

不要只设置其中一部分。COS 未配置时仅内置示例可以播放；正式问卷保持关闭。配置后只播放已登记的 COS 媒体，不回源 HF。

使用 `scripts/upload-cos.py --bucket gameintent-survey-1321360347 --region ap-shanghai` 批量上传 484 段约 2GB 视频。脚本凭证从 `COS_SECRET_ID`、`COS_SECRET_KEY` 环境变量读取，上传身份另需 PutObject 权限。源文件及上传后全文件 SHA-256 都会校验，失败可重跑；已有同名异内容对象不覆盖。上传者需能 SSH 访问原服务器。生成 `work/cos-upload-receipt.json` 后，在研究者后台题目池导入校验清单。

### 域名

- 问卷：`gameintent-survey.magic-lab.tech` → ESA 项目 → 域名添加此域名 → 在阿里云填写平台返回的验证与 CNAME 记录。
- 视频：`gameintent-media.magic-lab.tech` → COS 自定义默认源站域名，CNAME 使用 COS 控制台返回值，绑定 HTTPS 证书。
- COS CORS：Origin 为问卷正式 HTTPS 域名；Methods GET/HEAD；Allow-Headers Range；Expose-Headers ETag/Content-Length/Content-Range/Accept-Ranges；Max-Age 3600。添加实际测试域名时明确列出，不允许公开写入。
- 网站 `/api/*` 和带身份 Cookie 的响应不要设置公共 CDN 缓存。API 已返回 `Cache-Control: no-store`。

## 正式开放

先验证 `/api/config` 返回 `draft` 且每游戏有 40 个正式片段；主页能加载只说明前端正常，不能代替回收检查。研究者入口 `/?view=admin`。

填写研究联系方式、冻结数据版本，复核双语文本与每游戏两个练习及正负检查。不得把随机原标注自动当作负例，也不得为提高质量指标更改正式题原 GT。全部视频可播放后生成平衡分配、冻结题库，最后开启正式收集。正式库不混入试运行记录。

题库为 11 款游戏、440 正式视频 +44 练习/检查候选。每游戏 8 位参与者，每人25段正式视频，五人评价同一正式视频。两个判断分别评价标签支持与描述画面依据；英文、中文及双语标签解释同屏。

服务端保存草稿，提交锁定并去重；私人随机续答码恢复进度；撤回删除该参与者回答。完整 JSON/CSV 导出及审计日志位于研究者后台。

正式收集期间定期导出原始回答备份。Supabase 免费项目存在低活动暂停机制，发放前确认项目处于运行状态。Supabase 位于境外，需实测 ESA 到函数服务的提交延迟。

## 本地开发与检查

```sh
npm ci
cp .env.example .env.local  # 自行填写测试数据库，勿使用正式凭证
npm run dev
npm test
npm run test:flow
npm run test:flow:esa
npm run build
npm run build:esa
```

`test:flow` 和 `test:flow:esa` 只用本机内存 PostgreSQL 引擎及 374 条合成题目，不接触 Supabase。后者额外通过完整签名转发链检查并发名额、练习、资格、草稿、幂等提交、覆盖拒绝、跨用户隔离、续答、冻结、撤回和统计。数据库单元检查还覆盖事务回滚与重复回答保护。

离线统计：`node scripts/analyze-study.mjs --input study-export.json --out outputs/analysis`。

核心统计包括 Label support、Description grounding、Joint validity、Insufficient evidence、Krippendorff's alpha、来源×评审交叉重采样区间。未满五位独立有效评审的片段不进入主指标，信息不足票保留分母。
