-- ============================================================
-- KGTI Supabase 数据库初始化脚本
-- 
-- 使用方法：
--   1. 打开 Supabase Dashboard → SQL Editor
--   2. 新建查询 → 粘贴本文件全部内容
--   3. 点击 Run 执行
--
-- 注意：如果你已经执行过旧版本的建表脚本，请跳到
-- "5. 增量升级" 部分，只执行增量 ALTER TABLE 语句
-- ============================================================

-- ============================================================
-- 1. 测试结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS test_results (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   TEXT NOT NULL,                    -- 匿名用户标识
  personality  TEXT NOT NULL,                    -- 人格类型: ROBO/PURE/SEXY/FAKE/HIDE/SHOW/RICH/SOUL
  model_scores JSONB NOT NULL DEFAULT '[]',     -- 五维分数: [78, 65, 42, 55, 80]
  levels       JSONB NOT NULL DEFAULT '[]',     -- 12维度等级: [2, 1, 0, ...]
  test_number  INT DEFAULT 1,                   -- 该用户第几次测试
  referrer     TEXT,                             -- 来源页面 (document.referrer)
  utm_source   TEXT,                             -- URL 中的 utm_source 参数（追踪分享传播）
  user_agent   TEXT,                             -- 浏览器 User-Agent
  screen_size  TEXT,                             -- 屏幕尺寸 "375x812"
  env          TEXT NOT NULL DEFAULT 'prod',     -- 环境标识: 'prod' | 'dev'
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_results_personality ON test_results(personality);
CREATE INDEX IF NOT EXISTS idx_results_created_at  ON test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_results_session_id  ON test_results(session_id);
CREATE INDEX IF NOT EXISTS idx_results_env         ON test_results(env);

-- ============================================================
-- 2. 用户行为事件表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   TEXT NOT NULL,                    -- 匿名用户标识
  event_type   TEXT NOT NULL,                    -- 事件类型（见下方说明）
  event_data   JSONB,                            -- 附加数据
  env          TEXT NOT NULL DEFAULT 'prod',     -- 环境标识: 'prod' | 'dev'
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- event_type 说明：
--   'page_view'      — 打开页面
--   'test_start'     — 开始测试
--   'test_complete'  — 完成测试
--   'share_native'   — 使用系统原生分享
--   'share_copy'     — 复制分享文案
--   'save_image'     — 保存结果图片
--   'retest'         — 点击重新测试
--   'result_stay'    — 结果页停留（event_data.seconds = 停留秒数）

-- 索引
CREATE INDEX IF NOT EXISTS idx_events_type       ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON user_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_env        ON user_events(env);

-- ============================================================
-- 3. 启用 Row Level Security (RLS)
--    核心原则：前端只能 INSERT，不能 SELECT/UPDATE/DELETE
--    统计查询（getTestCount / getMatchStat）使用 count + head:true
-- ============================================================

-- test_results: 启用 RLS
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- 允许任何人（匿名用户）插入测试结果
CREATE POLICY "Allow anonymous insert" ON test_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 允许匿名用户读取（用于 count 统计查询）
CREATE POLICY "Allow anonymous select for counting" ON test_results
  FOR SELECT
  TO anon
  USING (true);

-- user_events: 启用 RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- 允许任何人插入行为事件
CREATE POLICY "Allow anonymous insert" ON user_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 行为事件表不允许前端读取（只有你在 Dashboard 里能看）
-- 不创建 SELECT 策略 = 默认拒绝读取

-- ============================================================
-- 4. 常用统计查询（在 Supabase SQL Editor 中手动执行）
-- ============================================================

-- 4.1 总测试人数（只看 prod）
-- SELECT COUNT(*) FROM test_results WHERE env = 'prod';

-- 4.2 各人格类型分布（只看 prod）
-- SELECT personality, COUNT(*) AS cnt,
--        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
-- FROM test_results
-- WHERE env = 'prod'
-- GROUP BY personality
-- ORDER BY cnt DESC;

-- 4.3 分享率（完成测试 vs 点击分享，只看 prod）
-- SELECT
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS completed,
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('share_native','share_copy')) AS shared,
--   ROUND(
--     COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('share_native','share_copy')) * 100.0
--     / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
--   ) AS share_rate_pct
-- FROM user_events
-- WHERE env = 'prod';

-- 4.4 保存图片率（只看 prod）
-- SELECT
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS completed,
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'save_image') AS saved,
--   ROUND(
--     COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'save_image') * 100.0
--     / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
--   ) AS save_rate_pct
-- FROM user_events
-- WHERE env = 'prod';

-- 4.5 各人格类型的分享率对比
-- SELECT
--   r.personality,
--   COUNT(DISTINCT r.session_id) AS test_count,
--   COUNT(DISTINCT e.session_id) AS share_count,
--   ROUND(COUNT(DISTINCT e.session_id) * 100.0 / NULLIF(COUNT(DISTINCT r.session_id), 0), 1) AS share_rate
-- FROM test_results r
-- LEFT JOIN user_events e ON r.session_id = e.session_id
--   AND e.event_type IN ('share_native','share_copy')
--   AND e.env = 'prod'
-- WHERE r.env = 'prod'
-- GROUP BY r.personality
-- ORDER BY share_rate DESC;

-- 4.6 平均结果页停留时长
-- SELECT
--   ROUND(AVG((event_data->>'seconds')::int), 1) AS avg_stay_seconds
-- FROM user_events
-- WHERE event_type = 'result_stay' AND env = 'prod';

-- 4.7 传播链追踪（从分享链接来的用户）
-- SELECT utm_source, COUNT(*) AS visitors
-- FROM test_results
-- WHERE utm_source IS NOT NULL AND env = 'prod'
-- GROUP BY utm_source
-- ORDER BY visitors DESC;

-- 4.8 重测率
-- SELECT
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'retest') AS retest_users,
--   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete') AS all_users,
--   ROUND(
--     COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'retest') * 100.0
--     / NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'test_complete'), 0), 1
--   ) AS retest_rate_pct
-- FROM user_events
-- WHERE env = 'prod';

-- 4.9 查看 dev 环境数据（调试用）
-- SELECT * FROM test_results WHERE env = 'dev' ORDER BY created_at DESC LIMIT 20;
-- SELECT * FROM user_events WHERE env = 'dev' ORDER BY created_at DESC LIMIT 20;

-- 4.10 清理 dev 环境数据（定期清理测试数据）
-- DELETE FROM user_events WHERE env = 'dev';
-- DELETE FROM test_results WHERE env = 'dev';


-- ============================================================
-- 5. 增量升级（如果你已经执行过旧版建表脚本）
--    只需要执行这几条 ALTER TABLE 即可
-- ============================================================

-- ALTER TABLE test_results ADD COLUMN IF NOT EXISTS env TEXT NOT NULL DEFAULT 'prod';
-- ALTER TABLE user_events  ADD COLUMN IF NOT EXISTS env TEXT NOT NULL DEFAULT 'prod';
-- CREATE INDEX IF NOT EXISTS idx_results_env ON test_results(env);
-- CREATE INDEX IF NOT EXISTS idx_events_env  ON user_events(env);
-- 执行完后，已有数据会自动标记为 env='prod'（因为 DEFAULT 'prod'）


-- ============================================================
-- 6. Vika 历史数据迁移
--    如果你之前在 Vika（维格表）中积累了测试数据，
--    可以按以下步骤导入到 Supabase
-- ============================================================

-- ── 步骤 1：从 Vika 导出 CSV ──
-- 
-- 方式 A（推荐）：Vika 网页端手动导出
--   1. 打开你的 Vika 数据表
--   2. 点右上角「⋮」→「导出为 CSV」
--   3. 下载得到一个 .csv 文件
--
-- 方式 B：通过 API 导出（适合数据量大的情况）
--   curl "https://api.vika.cn/fusion/v1/datasheets/你的datasheetId/records?pageSize=1000" \
--     -H "Authorization: Bearer 你的token" \
--     > vika_export.json
--   然后用脚本转成 CSV（见下方 Python 脚本）

-- ── 步骤 2：整理 CSV 格式 ──
--
-- Vika 导出的列名可能是中文，需要映射到 Supabase 的英文列名。
-- 确保 CSV 的列顺序和格式如下：
--
--   personality, model_scores, levels, created_at
--   ROBO,"[78,65,42,55,80]","[2,1,0,1,2,0,2,1,0,1,2,1]",2025-04-15T10:30:00+08:00
--   PURE,"[60,72,38,50,65]","[1,2,0,1,1,0,2,1,0,1,2,1]",2025-04-15T11:00:00+08:00
--
-- 注意：
--   - model_scores 和 levels 需要是 JSON 数组格式的字符串
--   - created_at 保留原始时间（带时区），这样你能保留数据的时间线
--   - 历史数据没有 session_id，用 'legacy-vika' 统一标识
--   - 历史数据没有 user_agent、screen_size 等字段，留空即可

-- ── 步骤 3：在 Supabase SQL Editor 中执行插入 ──
--
-- 如果数据量不大（< 100 条），可以直接写 INSERT：

-- INSERT INTO test_results (session_id, personality, model_scores, levels, env, created_at)
-- VALUES
--   ('legacy-vika', 'ROBO', '[78,65,42,55,80]', '[2,1,0,1,2,0,2,1,0,1,2,1]', 'prod', '2025-04-15T10:30:00+08:00'),
--   ('legacy-vika', 'PURE', '[60,72,38,50,65]', '[1,2,0,1,1,0,2,1,0,1,2,1]', 'prod', '2025-04-15T11:00:00+08:00');
--   -- ... 更多行

-- ── 步骤 4（可选）：用 Python 脚本批量迁移 ──
--
-- 如果你在 Vika 上有很多数据，可以用以下 Python 脚本自动迁移。
-- 保存为 migrate_vika_to_supabase.py，安装依赖后运行即可。
-- 脚本见项目根目录下的 migrate_vika_to_supabase.py

-- ── 步骤 5：验证迁移结果 ──
-- 
-- SELECT COUNT(*) FROM test_results WHERE session_id = 'legacy-vika';
-- SELECT personality, COUNT(*) FROM test_results WHERE session_id = 'legacy-vika' GROUP BY personality;
