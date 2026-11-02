# Game-Intention User Study

双语视频意图标注质量问卷，独立工程。Next.js + EdgeOne Pages Node.js + Supabase PostgreSQL + 腾讯云 COS。不依赖 ChatGPT Sites、Cloudflare D1/R2 或浏览器直连 HF。

## 导入 EdgeOne Pages

1. Supabase 项目 `gameintent-survey` 已创建，项目引用 `mtcfejthbrpgfqbtvuws`。进入 SQL Editor，执行 [supabase/001_schema.sql](supabase/001_schema.sql)，可重复执行，保留已有数据；已有列结构不兼容时会报出具体字段。
2. Supabase 顶部 Connect → Transaction pooler，复制完整 PostgreSQL URI，替换密码并对密码中的特殊字符做 URL 编码。连接端口为 6543；主机名从控制台复制，不要根据项目 URL 猜测。免费版无需购买 IPv4 插件。
3. [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages) → 创建项目 → 导入 Git 仓库 → 授权 GitHub 的本仓库 `YuiLu/gameintent-survey` → 分支 `main`。
4. 构建配置：框架 **Next.js**，根目录 `./`，安装 `npm ci`，构建 `npm run build`，输出 `.next`，Node.js `22.11.0`。仓库 `edgeone.json` 已保存对应设置。不要选择静态导出或输出 `out`。
5. 设置下表中的服务端环境变量后部署。预览与生产请使用不同 Supabase 项目，避免测试回答进入正式研究。不要对所有 Git 预览分支注入正式数据库凭证。

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** URI，只填 EdgeOne 服务端环境变量 |
| `DATABASE_CA_CERT` | 如 TLS 验证需要，粘贴 Supabase Database Settings 提供的 PEM 根证书；不关闭证书校验 |
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

- 问卷：`gameintent-survey.magic-lab.tech` → EdgeOne 项目 → 域名管理添加此域名 → 在阿里云填写平台返回的验证与 CNAME 记录。此前 Sites 返回的 CNAME 不用于本项目。
- 视频：`gameintent-media.magic-lab.tech` → COS 自定义默认源站域名，CNAME 使用 COS 控制台返回值，绑定 HTTPS 证书。
- COS CORS：Origin 为问卷正式 HTTPS 域名；Methods GET/HEAD；Allow-Headers Range；Expose-Headers ETag/Content-Length/Content-Range/Accept-Ranges；Max-Age 3600。添加实际测试域名时明确列出，不允许公开写入。
- 网站 `/api/*` 和带身份 Cookie 的响应不要设置公共 CDN 缓存。API 已返回 `Cache-Control: no-store`。

## 正式开放

先验证 `/api/config` 返回 `draft` 且每游戏有 40 个正式片段；主页能加载只说明前端正常，不能代替回收检查。研究者入口 `/?view=admin`。

填写研究联系方式、冻结数据版本，复核双语文本与每游戏两个练习及正负检查。不得把随机原标注自动当作负例，也不得为提高质量指标更改正式题原 GT。全部视频可播放后生成平衡分配、冻结题库，最后开启正式收集。正式库不混入试运行记录。

题库为 11 款游戏、440 正式视频 +44 练习/检查候选。每游戏 8 位参与者，每人25段正式视频，五人评价同一正式视频。两个判断分别评价标签支持与描述画面依据；英文、中文及双语标签解释同屏。

服务端保存草稿，提交锁定并去重；私人随机续答码恢复进度；撤回删除该参与者回答。完整 JSON/CSV 导出及审计日志位于研究者后台。

正式收集期间定期导出原始回答备份。Supabase 免费项目存在低活动暂停机制，发放前确认项目处于运行状态。Supabase 位于境外，需实测 EdgeOne 后端到所选数据库地域的连接与提交延迟。

## 本地开发与检查

```sh
npm ci
cp .env.example .env.local  # 自行填写测试数据库，勿使用正式凭证
npm run dev
npm test
npm run test:flow
npm run build
```

`test:flow` 只用本机内存 PostgreSQL 引擎及 374 条合成题目，不接触 Supabase。检查并发名额、练习、资格、草稿、幂等提交、覆盖拒绝、跨用户隔离、续答、冻结、撤回和统计。数据库单元检查还覆盖事务回滚与重复回答保护。

离线统计：`node scripts/analyze-study.mjs --input study-export.json --out outputs/analysis`。

核心统计包括 Label support、Description grounding、Joint validity、Insufficient evidence、Krippendorff's alpha、来源×评审交叉重采样区间。未满五位独立有效评审的片段不进入主指标，信息不足票保留分母。
