# User study 手动部署：Supabase + 阿里云 ESA + COS

适用于本仓库。核对日期：2026-11-03。流程为浏览器 → ESA 页面与同源 `/api/*` → Supabase `survey-api` 函数 → PostgreSQL；正式视频由私有 COS 提供。无需另租数据库服务器。

## 1. 准备代码与账号

准备 GitHub 仓库、Supabase 项目、已激活的 ESA 站点和 COS 桶。本项目当前映射如下；下次部署应替换为自己的实际值：

| 项目 | 当前值 |
|---|---|
| GitHub | `YuiLu/gameintent-survey`，分支 `main` |
| Supabase project ref | `mtcfejthbrpgfqbtvuws` |
| ESA 函数和 Pages | `gameintent-survey` |
| 问卷域名 | `gameintent-survey.magic-lab.tech` |
| COS | `gameintent-survey-1321360347`，`ap-shanghai` |
| 视频域名 | `gameintent-media.magic-lab.tech` |

安装 Node.js 22，执行 `npm ci`。环境变量不得添加 `NEXT_PUBLIC_` 前缀，真实值不提交 Git。`work/` 和 `.env*` 已被忽略。

## 2. 初始化 Supabase

1. 新建项目，安全保存数据库密码。
2. SQL Editor 执行 `supabase/001_schema.sql`。可重复执行，不删除已有数据；结构不兼容会报错。
3. 确认十张表位于独立的 `survey` schema，均启用 RLS。不要将 `survey` 加到 Data API 的公开 schema；不需要匿名读写策略。
4. 到 **Project Settings → API Keys**，取以 `sb_publishable_` 开头的 **publishable key**。这是公开项目标识，ESA 当前可用的是 46 字符格式。不要用 `sb_secret_`、`service_role` 或长版 anon JWT 替代。

## 3. 设置 Supabase 函数变量

在本机分别执行两次 `openssl rand -hex 32`，生成相互独立的管理密钥和网关签名密钥，自行安全保存。

进入 **Supabase → Edge Functions → Secrets**：

| 名称 | 填写方式 |
|---|---|
| `STUDY_ADMIN_KEY` | 管理后台密钥，仅研究负责人使用 |
| `STUDY_GATEWAY_KEY` | ESA 与 Supabase 之间的签名密钥，两个平台必须完全一致 |
| `STUDY_INITIAL_POOL` | `1`，只初始化空题库，不覆盖已有题目 |
| `DATABASE_URL` | 通常不用填：函数默认读取项目自带的 `SUPABASE_DB_URL` |
| `DATABASE_CA_CERT` | 通常不用填：代码已内置官方 Supabase 根证书，保持严格 TLS 校验 |

如需显式数据库连接，使用 **Connect → Transaction pooler** 提供的完整 URI，端口通常为 `6543`。替换密码占位符，并对密码特殊字符做 URL 编码；不要只填主机名。不要关闭证书校验来解决连接错误。

## 4. 部署 Supabase 后端

在仓库根目录运行：

```sh
npx supabase@3.0.0 login
npm run build:esa
npx supabase@3.0.0 functions deploy survey-api --remote=YOUR_PROJECT_REF --use-api --yes
```

将 `YOUR_PROJECT_REF` 换成实际项目引用。`--use-api` 不依赖 Docker。构建生成 `supabase/functions/survey-api/index.mjs`，该文件不入 Git。`supabase/config.toml` 保持 `verify_jwt = true`，不要添加 `--no-verify-jwt`。

函数地址为 `https://YOUR_PROJECT_REF.supabase.co/functions/v1/survey-api`。浏览器不直接调用这个地址；必须经过 ESA 签名入口。直接访问函数返回 401 是预期行为。

修改前端后需要重建 ESA；修改 `lib/study/server.ts`、数据库逻辑、协议、统计等后端代码后，必须先重新 `build:esa` 并部署 Supabase 函数，GitHub 推送不会自动更新 Supabase 后端。

## 5. 从 GitHub 导入 ESA

进入 **ESA → 边缘计算和 AI → 函数和 Pages → 创建 → 导入 GitHub**，选择本仓库及 `main`。

仓库 `esa.jsonc` 是构建配置来源：

| 项目 | 设置 |
|---|---|
| 根目录 | `/` |
| 安装命令 | `npm ci --registry=https://registry.npmjs.org --fetch-retries=4` |
| 构建命令 | `npm run build:esa` |
| 静态资源目录 | `dist-esa` |
| 函数入口 | `esa/worker.mjs` |
| 构建 Node.js | 22 |

ESA 托管静态 React 页面与轻量代理，不能将 `.next` 作为这里的静态目录，也不要把 Node PostgreSQL TCP 客户端直接放进 ESA 边缘函数。

## 6. 设置 ESA 变量

在 **项目 → 基本信息 → 函数变量 → 生产环境** 添加：

| 名称 | 填写方式 | 建议加密存储 |
|---|---|---|
| `STUDY_API_URL` | 第 4 步的完整函数地址 | 否 |
| `SUPABASE_PUBLISHABLE_KEY` | 第 2 步的短格式公开项目密钥 | 可选 |
| `STUDY_GATEWAY_KEY` | 与 Supabase Secrets 中相同的签名密钥 | 是 |

ESA 的变量界面限制每个值不超过 200 字符；不要填长版 `SUPABASE_ANON_KEY` JWT。私密签名密钥为 64 位十六进制字符串，符合限制。ESA 不需要数据库密码、管理密钥或 COS 密钥。

保存变量后，进入 **部署 → 构建历史 → 重新构建**，发布新版本。变量绑定在版本快照中，只保存变量不会更新已运行版本。测试环境单独配置，不能给任意 Git 分支注入正式凭证。

## 7. 绑定域名、CNAME 与 HTTPS

1. 在 **函数和 Pages → 本项目 → 域名 → 添加域名**，选择已激活 ESA 站点下的完整问卷域名。
2. 点击 **查看 DNS 记录**，复制平台返回的完整 CNAME。它是每次部署对应的实际值，不能根据函数名猜测。
3. 在域名权威 DNS 服务商中添加 CNAME。以当前项目为例：

| 字段 | 当前项目值 |
|---|---|
| DNS 区域 | `magic-lab.tech` |
| 类型 | `CNAME` |
| 主机记录 | `gameintent-survey` |
| 记录值 | `gameintent-survey.magic-lab.tech.a1.initjj.com` |
| 线路、TTL | 默认即可 |

此处修改的是权威 DNS（当前是阿里云云解析 DNS），不是在 ESA 中重复添加一次函数记录。记录值不含协议和路径；同名已有记录时修改原记录。无需更换整个域名的 NS。

4. 到 **ESA → 对应站点 → SSL/TLS → 边缘证书**。若已有证书覆盖该子域名或匹配的通配域名且已部署，可直接使用；否则申请 Let's Encrypt 免费证书，域名填写完整问卷域名。
5. 按页面提示完成域名验证；如有 DCV 验证记录，照页面实际值添加。确认 SSL/TLS 开启，等待证书签发并部署，再测试 HTTPS。

## 8. 配置 COS 视频

桶保持私有读写，为视频子域名配置 HTTPS。将下列五项同时填写到 **Supabase Edge Functions Secrets**，不是 ESA：

| 名称 | 示例 |
|---|---|
| `COS_BUCKET` | `gameintent-survey-1321360347` |
| `COS_REGION` | `ap-shanghai` |
| `COS_MEDIA_ORIGIN` | `https://gameintent-media.magic-lab.tech` |
| `COS_SECRET_ID` | 限定选中视频前缀 GetObject/HeadObject 的身份 |
| `COS_SECRET_KEY` | 上述身份的密钥 |

上传脚本使用另有 PutObject 权限的上传身份：

```sh
python3 scripts/upload-cos.py --bucket YOUR_BUCKET --region YOUR_REGION
```

凭证通过环境变量提供。脚本从实际视频来源读取，校验上传前后 SHA-256，生成 `work/cos-upload-receipt.json`。在研究者后台导入这份校验清单，服务端再次核对对象长度和 SHA 元数据。

视频域名 CNAME 使用 COS 控制台返回值。CORS 的 Origin 列出实际问卷 HTTPS 域名；允许 GET/HEAD 与 Range，暴露 Content-Length、Content-Range、Accept-Ranges、ETag。视频使用签名地址，不授予公开写权限。COS 未配置时只内置一个演示视频，不能据此认为全部正式题已可播放。

## 9. 验收与正式开放

先保持 `draft`，依次检查：

- 首页以及 CSS、JS 加载成功；切换中文/English 后，界面和文档语言实际变化，刷新保留选择。
- `/api/config` 能读取数据库及正确题数；`/api/health` 正常并不能单独证明回收正常。
- 后台未登录返回 401；未分配的正式视频返回 403；已授权的视频可播放并支持 Range/206。
- 在独立测试库验证两页判断、自动草稿、同一浏览器刷新恢复、幂等提交和撤回，不能向正式库灌测试回答。

研究者入口为 `/?view=admin`，使用 `STUDY_ADMIN_KEY` 登录。填写冻结数据版本、联系方式和中英文隐私说明，核对翻译、媒体、两个练习与正负检查，再生成平衡分配并正式开放。没有完成准备时，页面不会允许正式收集。

当前协议 2.2：熟悉游戏可多选，采用混合游戏分配。每批最多10道正式题，首批插入2道检查和1道重复；正式阶段累计5段视频后出现结束按钮（示例不计入），也可继续下一批。问卷不提前展示结束门槛。结束会保留回答并释放未答名额，撤回则删除回答。名额分配在数据库事务中串行检查，每人每条正式样本至多一次、每条至多五位有效评审。初始两个示例讲解共同评价规则；熟悉程度为受试者对所选游戏共同确认的最低水平。原单游戏平衡表保留用于兼容已有分配，新参与者按所选游戏的剩余名额分配。研究者需跟踪每个视频实际回收五份评价，而非只数参与人数。

440段正式视频需要2,200份有效正式评价。满5段立即结束时，按当前插入顺序包含2道检查，通常贡献3份正式评价，因此约需734人；继续答题者会减少所需人数，质检排除与缺失会增加招募量。这是预估，不是覆盖保证。

分析保留标签支持率、描述有画面依据比例、联合有效率、信息不足率、95%置信区间、Krippendorff’s α，新增按游戏的 nominal Fleiss’ κ。重复题一致率和检查题通过率属于质控。F1/召回需另行设计盲选标签任务，不能由当前支持度评分直接转换。

不发续答码。服务端会话 Cookie 恢复同一浏览器的进度，正式题草稿自动同步，网络失败时保留本机草稿。清除站点数据、隐私浏览会话结束或换浏览器后，不能靠续答码恢复。

发布新协议只自动更新未分配、无参与者的草稿研究；已有分配、冻结或回答的研究不自动改题量。正式收集后定期导出 JSON/CSV；分析仍保留每视频恰好五位独立有效评审的规则。

## 10. 免费额度与费用边界

截至核对日期，官方说明区分两项：

- **ESA 免费站点套餐**：站点流量标为不限量，但限制峰值带宽与单请求速率，无 SLA，并不承诺大流量业务性能。
- **函数和 Pages 免费模式**：每账号每天 100,000 次函数请求、每函数全网 1,000 并发；超出日请求数返回 503，次日零点恢复。免费模式还限制每账号 20 个函数、每函数 5 个版本。Pages 流量使用站点套餐额度。

自动保存、视频鉴权、提交、题库读取都产生请求。额度由同一账号其他函数共享；不能按“参与人数”直接理解请求额度。视频从 COS 下载，COS 存储与出流量，以及 Supabase 的额度分别计算，不包含在 ESA 免费额度中。

参考：[免费套餐](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-plan)、[套餐对比](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/package-function-comparison/)、[函数和 Pages 计费](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/functions-and-pages-billing)。后续部署以控制台和当时文档为准。

## 常见问题

| 现象 | 检查项 |
|---|---|
| `relation already exists` | 使用本仓库可重复执行的 schema；已有项目不用重复建库 |
| 页面可开，API 503 | ESA 三项变量、Supabase 变量，以及保存后是否重建发布 |
| HTTP 页面能显示，但提示“请求格式无效” | 公开页面和 API 必须走 HTTPS；当前入口自动升级协议，发布时需同时更新 ESA 页面和函数 |
| ESA 变量超过 200 字符 | 用短 `sb_publishable_` 项目密钥，不填长 anon JWT |
| 函数直接访问 401 | 私密 HMAC 网关拒绝是预期；通过问卷 `/api/*` 验收 |
| 云端 `NotSupported: setEnv` | Supabase 环境变量只读；更新到当前代码，不在运行中赋值 `process.env` |
| 数据库 TLS 错误 | 使用官方根证书和完整连接串，检查函数部署是否最新 |
| GitHub 已更新，后端仍旧 | Supabase 后端需要单独重新构建部署 |
| HTTPS 域名不匹配 | 证书必须覆盖完整问卷子域名，根域证书不自动覆盖子域 |
| CNAME 待配置 | 检查权威 DNS 中的前缀、平台返回目标及同名冲突 |
| 某日集中返回 503 | 检查账号函数日请求限额以及数据库是否暂停 |

## 线上试填与视频首次上传

购买 COS 不会自动产生 API 密钥。在腾讯云 CAM → 用户 → 用户列表创建专用子用户，在该用户的 API 密钥页创建密钥。SecretKey 只在创建时显示一次。将两项填入 Supabase Secrets；不要填入 ESA 或前端。子用户可绑定 [上传策略](cos-upload-policy.json)，只允许本桶视频前缀的读取、HEAD 检查和上传，不含删除。

候选题还没有人工参考答案时，可开放 `pilot` 试填，页面明确显示测试；缺少视频或双语文本仍会阻止开放。试填允许先检查界面和回收，不将候选检查题伪装为已人工审核。正式 `live` 仍需补齐原有复核与配置要求，已有试填数据也会阻止直接切入正式收集。

- Supabase 另外配置非敏感项：`COS_BUCKET=gameintent-survey-1321360347`、`COS_REGION=ap-shanghai`、`COS_MEDIA_ORIGIN=https://gameintent-media.magic-lab.tech`。
- 视频域名还没配好时，可暂设 `COS_PROXY_PLAYBACK=1`。视频经已鉴权问卷接口流式转发，保留 Range/206，不需要公开视频桶；视频流量也会经过 Supabase/ESA，正式收集前应配置视频域名并关闭转发。
- 首次上传临时启用 `STUDY_MEDIA_SETUP=1`。维护请求除了 ESA 转发签名，还要求独立用途的 HMAC 派生令牌。浏览器持有发布密钥不能获得上传凭证。
- 在已保存私有网关配置的工作目录运行 `node scripts/upload-cos-gateway.mjs`。脚本从冻结清单指定的服务器文件读取，核对原文件 SHA-256，使用十分钟有效且绑定 MD5/SHA-256 的 PUT 地址上传，再回读核对 SHA-256，最后登记入库。支持已登记对象断点续传，输出不含密钥或签名地址。
- 上传完成后再通过维护或管理员入口开放 `pilot`，确认真实视频、草稿、提交和统计链路。最后将 `STUDY_MEDIA_SETUP=0`，关闭上传维护入口。

`127.0.0.1:8040` 的旧只读布局预览不是在线问卷，不应作为试填入口。线上使用已部署证书的问卷域名；证书待配置时可使用 ESA 控制台「访问」生成的限时测试链接。

## 盲选标签协议 3.0

每段先隐藏自动标签和描述，仅显示视频、所问对象及固定的游戏标签候选表（`data/label-catalog.json`，中英文名称与解释，可搜索、多选，支持画面不足／不熟悉）。候选表按问卷涉及的标签和游戏词汇表固定生成，计算结果限于该候选标签空间，不应声称覆盖词表外的所有意图。

播放后将选择写入服务端不可变锁，再返回原标签与描述，进行描述依据评价；前端草稿的页码不能提前揭示答案，重复锁定不同选择返回409。正式题和练习均执行相同顺序，刷新恢复锁定状态。已有记录不删除；旧试填会话升级时标记为已经可能曝光，其后回答不进入独立盲选F1。新进入者使用blind-v1，原描述支持题型结果仍保留并单独统计。

F1以自动标签为预测、人类盲选为参考：每视频恰好五位独立有效评审，至少三人选择的标签进入共识集合；空共识单独报告，不静默记为全错或全对。按游戏报告precision、recall、micro/macro F1与集合全对，以及信息不足／不熟悉比例、描述依据充分比例。旧标签支持率不能与盲选F1直接比较。pilot回答仍排除在正式统计之外。

## 视频加载路径

ESA 的视频 GET 请求在服务端签名信封中添加媒体转发标记。Supabase 仍核对当前用户、题目分配和已入库媒体，但仅向 ESA 返回 COS 只读签名地址；视频字节由 ESA 直接从上海 COS 流式读取，避免通过 Supabase 转发。浏览器不接触 COS 密钥或签名地址，支持 Range/206/416，视频仅允许私有浏览器缓存5分钟，业务接口及签名地址禁止缓存。

部署顺序：先构建并部署 Supabase 函数，再推送 GitHub 触发 ESA 发布。旧 ESA 与 Node 部署仍按 `COS_PROXY_PLAYBACK` 配置工作，不需要改动现有变量。播放器会预加载当前片段，网络失败最多自动重试两次，重连保留播放位置和已观看时长；不会预取下一题或提前显示原标注。

## 四项意图组合协议 3.1

当前标签阶段改为四选一：保留原标注的完整标签集合为一项，另外三项从同游戏、该题原标注之外的标签抽取。四项的标签数量一致，多标签题不会被拆成单标签题；这些是按标注构造的干扰项，不代表已由人工确认它们与视频必然不符。中英文标签与定义保留，搜索框移除，画面不足／不熟悉仍可选择。锁定后再显示原标注并评价描述。

候选组合由服务器的私有种子和题目生成，呈现顺序再按参与者打乱；同一参与者刷新、重复题和恢复进度保持一致。服务器根据选项 ID 决定实际标签，拒绝伪造选项；锁定记录保存四项组合快照，不依赖客户端提交的标签或正确答案标记。

新回答标记为 `blind-four-v1`，旧 `blind-v1` 回答、草稿和锁定记录保留。后台和离线分析分别统计四项组合与原标注的一致率（包括与不包括弃答两种分母）、五人多数一致率、弃答率与描述支持率；只对已获得完整五人评价的视频输出按游戏指标。四选一随机选择与原标注一致的概率为25%。这是给定候选组合的判断，不能作为全词表独立盲选 F1 或召回使用，也不与此前 F1 合并。pilot 记录仍排除在正式研究指标之外。
