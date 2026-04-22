# KGTI 统计后端部署指南（Supabase 版）

## 架构概览

```
┌──────────────┐     HTTPS      ┌───────────────────┐
│  KGTI 前端   │ ──────────────→│   Supabase         │
│ (EdgeOne     │  Supabase JS   │   PostgreSQL       │
│  Pages 托管) │ ←──────────────│   (免费 500MB)     │
└──────────────┘                └───────────────────┘
```

**无需服务器、无需中转服务**，前端通过 Supabase JS SDK 直接读写数据库。

## 免费额度

| 项目 | 免费版限制 |
|------|-----------|
| 数据库存储 | 500 MB（约 200 万条记录） |
| API 请求 | 不限次 |
| 带宽 | 5 GB / 月 |
| 实时连接 | 200 并发 |
| 项目数 | 2 个 |

按日活 1,000 人估算，可免费使用 **4~5 年**。

---

## 部署步骤

### 第 1 步：创建 Supabase 项目

1. 打开 https://supabase.com → 用 GitHub 登录
2. 点 **New Project**
3. 填写项目名（如 `kgti`），选 Region（推荐 **Tokyo** 或 **Singapore**）
4. 设置数据库密码 → Create

### 第 2 步：执行建表 SQL

1. 进入项目 Dashboard → 左侧菜单 **SQL Editor**
2. 点 **New Query**
3. 把 `supabase-setup.sql` 文件的全部内容粘贴进去
4. 点 **Run** 执行

成功后会创建两张表：
- `test_results` — 测试结果（人格类型、五维分数、维度等级等）
- `user_events` — 用户行为事件（分享、保存图片、停留时长等）

### 第 3 步：确认配置

在 `app.js` 中确认以下配置已正确填写：

```javascript
const SUPABASE_CONFIG = {
  supabaseUrl: 'https://xxxxx.supabase.co',   // 你的 Project URL
  supabaseKey: 'sb_publishable_xxxx'           // 你的 Publishable API Key
};
```

获取方式：Dashboard → Settings → API

### 第 4 步：验证

1. 在本地打开 `index.html`
2. 完成一次测试
3. 回到 Supabase Dashboard → Table Editor
4. 检查 `test_results` 和 `user_events` 表中是否有新记录

---

## 数据安全

### Row Level Security (RLS)

已通过 SQL 脚本配置了严格的安全策略：

| 表 | INSERT | SELECT | UPDATE | DELETE |
|----|--------|--------|--------|--------|
| test_results | ✅ 允许 | ✅ 允许（用于 count 统计） | ❌ 拒绝 | ❌ 拒绝 |
| user_events | ✅ 允许 | ❌ 拒绝 | ❌ 拒绝 | ❌ 拒绝 |

- 前端只能**插入**数据，不能修改或删除
- `test_results` 允许读取是因为需要做 count 统计（显示测试人数和同型占比）
- `user_events` **完全禁止前端读取**，只有你在 Dashboard 中才能查看

### Publishable Key 安全性

`publishable key` 本身是公开的（会出现在前端代码中），但安全性由 RLS 策略保证：
- 即使拿到 key，也只能做 INSERT，不能批量导出数据
- 不能修改或删除任何记录

---

## 数据收集字段

### test_results 表

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | TEXT | 匿名用户标识（UUID，存在 localStorage） |
| personality | TEXT | 人格类型 ROBO/PURE/SEXY/FAKE/HIDE/SHOW/RICH/SOUL |
| model_scores | JSONB | 五维分数 [78, 65, 42, 55, 80] |
| levels | JSONB | 12维度等级 [2, 1, 0, ...] |
| test_number | INT | 该用户第几次测试 |
| referrer | TEXT | 来源页面 |
| utm_source | TEXT | 分享追踪标记 |
| user_agent | TEXT | 浏览器信息 |
| screen_size | TEXT | 屏幕尺寸 |
| env | TEXT | 环境标识：`'prod'` 或 `'dev'` |
| created_at | TIMESTAMPTZ | 提交时间 |

### user_events 表

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | TEXT | 匿名用户标识 |
| event_type | TEXT | 事件类型（见下方） |
| event_data | JSONB | 附加数据 |
| env | TEXT | 环境标识：`'prod'` 或 `'dev'` |
| created_at | TIMESTAMPTZ | 事件时间 |

### 事件类型一览

| event_type | 触发时机 | event_data |
|-----------|---------|------------|
| `page_view` | 打开页面 | `{url, referrer, utm_source}` |
| `test_start` | 点击"开始测试" | — |
| `test_complete` | 完成测试出结果 | `{personality}` |
| `share_native` | 使用系统分享 | `{personality}` |
| `share_copy` | 复制分享文案 | `{personality}` |
| `save_image` | 保存结果图片 | `{personality}` |
| `retest` | 点击重新测试 | — |
| `result_stay` | 离开结果页时 | `{seconds}` |

---

## 常用统计查询

在 Supabase Dashboard → SQL Editor 中执行：

### 总测试人数
```sql
SELECT COUNT(*) FROM test_results WHERE env = 'prod';
```

### 各人格类型分布
```sql
SELECT personality, COUNT(*) AS cnt,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM test_results
WHERE env = 'prod'
GROUP BY personality
ORDER BY cnt DESC;
```

### 分享率
```sql
SELECT
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS completed,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('share_native','share_copy')) AS shared,
  ROUND(
    COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('share_native','share_copy')) * 100.0
    / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
  ) AS share_rate_pct
FROM user_events
WHERE env = 'prod';
```

### 保存图片率（社交名片意愿指标）
```sql
SELECT
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS completed,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'save_image') AS saved,
  ROUND(
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'save_image') * 100.0
    / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
  ) AS save_rate_pct
FROM user_events
WHERE env = 'prod';
```

### 各人格类型分享率对比
```sql
SELECT
  r.personality,
  COUNT(DISTINCT r.session_id) AS test_count,
  COUNT(DISTINCT e.session_id) AS share_count,
  ROUND(COUNT(DISTINCT e.session_id) * 100.0 / NULLIF(COUNT(DISTINCT r.session_id), 0), 1) AS share_rate
FROM test_results r
LEFT JOIN user_events e ON r.session_id = e.session_id
  AND e.event_type IN ('share_native','share_copy')
  AND e.env = 'prod'
WHERE r.env = 'prod'
GROUP BY r.personality
ORDER BY share_rate DESC;
```

### 平均结果页停留时长
```sql
SELECT ROUND(AVG((event_data->>'seconds')::int), 1) AS avg_stay_seconds
FROM user_events WHERE event_type = 'result_stay' AND env = 'prod';
```

### 重测率
```sql
SELECT
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'retest') AS retest_users,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS all_users,
  ROUND(
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'retest') * 100.0
    / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
  ) AS retest_rate_pct
FROM user_events
WHERE env = 'prod';
```

---

## Dev / Prod 环境分离

### 工作原理

代码会**自动检测**当前环境并给数据打标签 `env: 'prod'` 或 `env: 'dev'`：

| 访问方式 | 判定为 | 说明 |
|---------|--------|------|
| 正式域名（自定义域名或 `<project>.pages.dev`） | `prod` | 推送 `main` 分支后自动构建 |
| Preview URL（`<hash>.<project>.pages.dev`） | `dev` | 推送非 main 分支后自动构建 |
| `localhost` / `127.0.0.1` / `file://` | `dev` | 本地开发 |
| URL 带 `?env=dev` 参数 | `dev` | 手动强制指定 |

### EdgeOne Pages 操作方式

你现在的工作流（推 `main` → 自动构建 prod）**完全不需要改**。只需要加一个 dev 分支：

```bash
# 日常开发流程
git checkout -b dev          # 创建 dev 分支
# ... 修改代码 ...
git add . && git commit -m "feature: xxx"
git push origin dev          # 推送 → EdgeOne 自动构建 Preview 环境
# 在 Preview URL 上测试

# 测试通过后合并到 main
git checkout main
git merge dev
git push origin main         # 推送 → EdgeOne 自动构建 Production 环境
```

### 统计查询时过滤环境

```sql
-- 只看 prod 数据（正式统计）
SELECT COUNT(*) FROM test_results WHERE env = 'prod';

-- 只看 dev 数据（调试验证）
SELECT * FROM test_results WHERE env = 'dev' ORDER BY created_at DESC LIMIT 20;

-- 定期清理 dev 测试数据
DELETE FROM user_events WHERE env = 'dev';
DELETE FROM test_results WHERE env = 'dev';
```

---

## 从 Vika 迁移历史数据

如果你之前在 Vika（维格表）中积累了测试数据，有三种迁移方式：

### 方式 A：手动插入（数据量 < 50 条）

在 Supabase SQL Editor 中直接执行 INSERT：

```sql
INSERT INTO test_results (session_id, personality, model_scores, levels, env, created_at)
VALUES
  ('legacy-vika', 'ROBO', '[78,65,42,55,80]', '[2,1,0,1,2,0,2,1,0,1,2,1]', 'prod', '2025-04-15T10:30:00+08:00'),
  ('legacy-vika', 'PURE', '[60,72,38,50,65]', '[1,2,0,1,1,0,2,1,0,1,2,1]', 'prod', '2025-04-15T11:00:00+08:00');
```

### 方式 B：CSV 导入（通过 Supabase Dashboard）

1. 从 Vika 网页端导出 CSV（点右上角 ⋮ → 导出为 CSV）
2. 整理列名匹配 Supabase 表结构
3. 在 Supabase Dashboard → Table Editor → test_results → Insert → Import from CSV

### 方式 C：Python 脚本自动迁移（推荐，数据量大时）

```bash
pip install requests
python migrate_vika_to_supabase.py
```

脚本会：
1. 通过 Vika API 分页读取所有记录
2. 自动转换字段格式
3. 批量写入 Supabase
4. 所有迁移数据统一标记 `session_id = 'legacy-vika'`

> ⚠️ 使用前需在脚本中填写 `VIKA_TOKEN` 和 `VIKA_DATASHEET_ID`。
> 可以在浏览器控制台解码旧代码中的混淆配置获得。

| | Vika（旧） | Supabase（新） |
|---|-----------|---------------|
| 月调用上限 | 1 万次 | **不限** |
| 存储 | 5 万行 | **500 MB（~200 万行）** |
| 查询能力 | 简单筛选 | **完整 SQL** |
| 行为追踪 | 无 | **8 种事件类型** |
| 需要中转服务 | 否 | **否** |
| 费用 | 免费 | **免费** |

---

## 分享传播追踪

在分享链接后加上 `?utm_source=xxx` 参数即可追踪传播链：

```
https://你的域名/?utm_source=bilibili
https://你的域名/?utm_source=wechat
https://你的域名/?utm_source=xiaohongshu
```

查询传播效果：
```sql
SELECT utm_source, COUNT(*) AS visitors
FROM test_results
WHERE utm_source IS NOT NULL
GROUP BY utm_source
ORDER BY visitors DESC;
```
