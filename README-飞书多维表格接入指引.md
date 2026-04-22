# KGTI 数据收集迁移指引：维格表 → 飞书多维表格

> 免费额度从 **1 万次/月** 提升到 **100 万次/月**（100 倍），其他功能体验不变。

---

## ⚠️ 重要前置须知

| 对比项 | 维格表 (Vika) | 飞书多维表格 |
|--------|-------------|-------------|
| 认证方式 | 静态 API Token，永不过期 | `tenant_access_token`，**2 小时过期** |
| 前端直调 | ✅ 可以（Token 写在前端） | ❌ 不行（需要 `app_secret` 换 Token） |
| 免费额度 | 1 万次/月 | **100 万次/月** |
| 单次查询上限 | 1000 条 | 500 条 |

**核心差异**：飞书 API 需要用 `app_id` + `app_secret` 先换一个临时 Token，而 `app_secret` 不能暴露到前端。所以你需要一个**轻量服务端做中转**（推荐 Cloudflare Workers，免费额度 10 万次/天）。

### 架构变化

```
当前（维格表）：
  浏览器 ──── fetch ────→ Vika API（直连）

迁移后（飞书）：
  浏览器 ──── fetch ────→ Cloudflare Worker ────→ 飞书 API
                          （管理 Token 刷新）
```

---

## 一、创建飞书应用

### 1. 注册飞书

如果没有飞书账号：
1. 下载飞书 APP 或访问 [feishu.cn](https://www.feishu.cn)
2. 用手机号注册一个**个人版**账号（免费）

### 2. 创建自建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)，用飞书账号登录
2. 点击右上角 **「创建应用」** → 选择 **「企业自建应用」**
3. 填写应用信息：
   - **应用名称**：`KGTI数据收集`（随意）
   - **应用描述**：`KGTI测试结果数据收集`
   - **应用图标**：随便上传一个
4. 点击 **「确定创建」**

### 3. 获取凭证

进入应用详情页 → 左侧导航 **「凭证与基础信息」**：

| 凭证 | 示例 | 说明 |
|------|------|------|
| **App ID** | `cli_a5xxxxxxxxxx` | 应用唯一标识 |
| **App Secret** | `xxxxxxxxxxxxxxxx` | 密钥，**不要泄露到前端** |

> 📝 **记下这两个值**，后面配置 Worker 要用。

### 4. 配置权限

左侧导航 → **「权限管理」** → 搜索并开通以下权限：

| 权限名称 | 权限标识 | 用途 |
|---------|---------|------|
| 查看、评论和编辑多维表格 | `bitable:app` | 读写数据 |

开通后点击右上角 **「创建版本」** → 填写版本号（如 `1.0.0`） → **「发布」**。

> ⚠️ 个人版飞书会自动审批。如果是企业飞书，需要管理员审批后才生效。

---

## 二、创建多维表格

### 1. 在飞书中创建

1. 打开飞书 → 左侧 **「云文档」** → **「新建」** → **「多维表格」**
2. 命名为 **`KGTI测试结果`**

### 2. 创建字段（列）

在新表格中创建以下 4 列：

| 列名 | 字段类型 | 说明 |
|------|---------|------|
| `人格类型` | **文本** | 如 "SOUL"、"ROBO" |
| `五维分数` | **文本** | JSON 数组，如 "[78,65,42,55,80]" |
| `维度等级` | **文本** | JSON 数组，如 "[3,2,1,4,2,3,1,2,4,3,2,1]" |
| `提交时间` | **文本** | ISO 时间字符串 |

> 💡 列名必须与上表完全一致。

### 3. 获取 app_token 和 table_id

打开你的多维表格，查看浏览器地址栏：

```
https://xxx.feishu.cn/base/bascnXXXXXXXXXXXX?table=tblXXXXXXXXXXXX&view=vewXXXXXXXXXXXX
```

| 值 | 位置 | 示例 |
|----|------|------|
| **app_token** | `base/` 后面的字符串 | `bascnXXXXXXXXXXXX` |
| **table_id** | `table=` 后面的字符串 | `tblXXXXXXXXXXXX` |

> 📝 **记下这两个值**。

### 4. 给应用授权访问

**关键步骤**（很多人忘了这步导致 403）：

1. 在多维表格右上角点击 **「...」** → **「更多」** → **「添加文档应用」**
   - 或者点击右上角 **分享** 按钮 → 搜索你的应用名（如 `KGTI数据收集`）
2. 将应用添加为文档协作者，权限选 **「可编辑」**

> 这一步是让你的自建应用有权限访问这张多维表格。

---

## 三、部署 Cloudflare Worker（免费中转服务）

### 为什么需要中转？

飞书的 `tenant_access_token` 需要用 `app_secret` 换取（2 小时过期），而 `app_secret` **绝不能暴露在前端**。Cloudflare Workers 免费版每天 10 万次请求，完全够用。

### 1. 注册 Cloudflare

1. 访问 [dash.cloudflare.com](https://dash.cloudflare.com/)
2. 注册账号（免费）

### 2. 创建 Worker

1. 左侧导航 → **「Workers & Pages」** → **「Create」**
2. 点击 **「Create Worker」**
3. 命名为 `kgti-feishu`（随意）
4. 点击 **「Deploy」**
5. 部署成功后点击 **「Edit Code」** → 编辑代码

### 3. 粘贴以下代码

```javascript
/**
 * KGTI 飞书多维表格中转 Worker
 * 功能：管理 Token 刷新 + 代理前端的读写请求
 */

const FEISHU_APP_ID = '你的App ID';       // 替换！
const FEISHU_APP_SECRET = '你的App Secret'; // 替换！
const FEISHU_APP_TOKEN = '你的app_token';   // 替换！
const FEISHU_TABLE_ID = '你的table_id';     // 替换！

// 允许的前端域名（CORS），* 表示允许所有
const ALLOWED_ORIGINS = ['*'];

// Token 缓存
let cachedToken = null;
let tokenExpireTime = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireTime) {
    return cachedToken;
  }

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    })
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 Token 失败: ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  // 提前 5 分钟刷新
  tokenExpireTime = now + (data.expire - 300) * 1000;
  return cachedToken;
}

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes('*') ? '*' : 
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

const BASE = 'https://open.feishu.cn/open-apis/bitable/v1/apps';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      const token = await getToken();
      const feishuHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      };

      const path = url.pathname;

      // ---- POST /submit —— 提交测试结果 ----
      if (path === '/submit' && request.method === 'POST') {
        const body = await request.json();
        const fields = {
          '人格类型': body.personality || '',
          '五维分数': JSON.stringify(body.modelScores || []),
          '维度等级': JSON.stringify(body.levels || []),
          '提交时间': new Date().toISOString()
        };

        const res = await fetch(
          `${BASE}/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
          {
            method: 'POST',
            headers: feishuHeaders,
            body: JSON.stringify({ fields })
          }
        );
        const data = await res.json();

        return new Response(JSON.stringify({
          success: data.code === 0,
          message: data.msg
        }), { headers: corsHeaders(origin) });
      }

      // ---- GET /count —— 获取测试总人数 ----
      if (path === '/count' && request.method === 'GET') {
        const res = await fetch(
          `${BASE}/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records?page_size=1`,
          {
            method: 'GET',
            headers: feishuHeaders
          }
        );
        const data = await res.json();

        return new Response(JSON.stringify({
          success: data.code === 0,
          total: data.data?.total || 0
        }), { headers: corsHeaders(origin) });
      }

      // ---- GET /stats —— 获取各人格类型统计 ----
      if (path === '/stats' && request.method === 'GET') {
        const typeCounts = {};
        let totalCount = 0;
        let pageToken = null;
        let hasMore = true;

        while (hasMore) {
          let reqUrl = `${BASE}/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records?page_size=500&field_names=${encodeURIComponent('["人格类型"]')}`;
          if (pageToken) {
            reqUrl += `&page_token=${pageToken}`;
          }

          const res = await fetch(reqUrl, {
            method: 'GET',
            headers: feishuHeaders
          });
          const data = await res.json();

          if (data.code !== 0 || !data.data?.items) {
            hasMore = false;
            break;
          }

          data.data.items.forEach(item => {
            const type = item.fields?.['人格类型'];
            if (type) {
              // 飞书文本字段可能返回富文本结构，需要处理
              const typeStr = typeof type === 'string' ? type :
                (Array.isArray(type) ? type.map(t => t.text || t).join('') : String(type));
              typeCounts[typeStr] = (typeCounts[typeStr] || 0) + 1;
              totalCount++;
            }
          });

          hasMore = data.data.has_more || false;
          pageToken = data.data.page_token || null;
        }

        return new Response(JSON.stringify({
          success: true,
          total: totalCount,
          typeCounts
        }), { headers: corsHeaders(origin) });
      }

      // 未匹配的路由
      return new Response(JSON.stringify({
        success: false,
        message: 'Not Found. Available: POST /submit, GET /count, GET /stats'
      }), { status: 404, headers: corsHeaders(origin) });

    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        message: e.message
      }), { status: 500, headers: corsHeaders(origin) });
    }
  }
};
```

### 4. 配置环境变量（推荐）

为了安全，建议不要把密钥硬编码在代码里：

1. Worker 设置页 → **「Settings」** → **「Variables」**
2. 添加以下变量（类型选 **Secret**）：

| 变量名 | 值 |
|--------|-----|
| `FEISHU_APP_ID` | 你的 App ID |
| `FEISHU_APP_SECRET` | 你的 App Secret |
| `FEISHU_APP_TOKEN` | 你的 app_token |
| `FEISHU_TABLE_ID` | 你的 table_id |

然后把代码顶部 4 个常量改为从 `env` 读取：

```javascript
// 把代码顶部改为：
export default {
  async fetch(request, env, ctx) {
    const FEISHU_APP_ID = env.FEISHU_APP_ID;
    const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
    const FEISHU_APP_TOKEN = env.FEISHU_APP_TOKEN;
    const FEISHU_TABLE_ID = env.FEISHU_TABLE_ID;
    // ... 后续代码不变
  }
};
```

### 5. 部署

点击 **「Save and Deploy」**，记下你的 Worker URL：

```
https://kgti-feishu.你的账号.workers.dev
```

### 6. 测试

在浏览器中访问 `https://kgti-feishu.你的账号.workers.dev/count`，应该返回：

```json
{"success": true, "total": 0}
```

---

## 四、修改前端代码

部署好 Worker 后，修改前端代码对接新的 API。

### 1. 修改 `app.js` 中的配置

把 Vika 配置替换为 Worker 地址：

```javascript
// ---- 旧代码（维格表）----
// const VIKA_CONFIG = {
//   token: _d('...'),
//   datasheetId: _d('...')
// };

// ---- 新代码（飞书 via Worker）----
const STATS_API_BASE = 'https://kgti-feishu.你的账号.workers.dev';
```

### 2. 修改 `stats-backend.js`

用更简单的 Worker 代理客户端替换原有的 Vika 客户端：

```javascript
const StatsBackend = (() => {
  let _initialized = false;
  let _apiBase = '';

  const CACHE_TTL = 5 * 60 * 1000;
  let _cache = {
    totalCount: { value: null, time: 0 },
    typeCounts: { value: null, time: 0 }
  };

  function init({ apiBase }) {
    if (_initialized) return true;
    if (!apiBase) {
      console.warn('[StatsBackend] 缺少 apiBase，统计收集已禁用');
      return false;
    }
    _apiBase = apiBase.replace(/\/$/, '');
    _initialized = true;
    return true;
  }

  async function submitResult({ personality, modelScores, levels }) {
    if (!_initialized) return { success: false };
    try {
      const res = await fetch(`${_apiBase}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality, modelScores, levels })
      });
      const data = await res.json();
      if (data.success) {
        _cache.totalCount.time = 0;
        _cache.typeCounts.time = 0;
      }
      return data;
    } catch (e) {
      console.warn('[StatsBackend] 提交异常:', e.message);
      return { success: false };
    }
  }

  async function getTestCount() {
    if (!_initialized) return null;
    if (_cache.totalCount.value !== null && Date.now() - _cache.totalCount.time < CACHE_TTL) {
      return _cache.totalCount.value;
    }
    try {
      const res = await fetch(`${_apiBase}/count`);
      const data = await res.json();
      if (data.success) {
        _cache.totalCount = { value: data.total, time: Date.now() };
        return data.total;
      }
      return null;
    } catch (e) {
      console.warn('[StatsBackend] 获取总数失败:', e.message);
      return null;
    }
  }

  async function getMatchStat(personality) {
    if (!_initialized || !personality) return null;
    try {
      let typeCounts = _cache.typeCounts.value;
      let totalCount = 0;

      if (typeCounts && Date.now() - _cache.typeCounts.time < CACHE_TTL) {
        totalCount = Object.values(typeCounts).reduce((s, v) => s + v, 0);
      } else {
        const res = await fetch(`${_apiBase}/stats`);
        const data = await res.json();
        if (!data.success) return null;
        typeCounts = data.typeCounts;
        totalCount = data.total;
        _cache.typeCounts = { value: typeCounts, time: Date.now() };
        _cache.totalCount = { value: totalCount, time: Date.now() };
      }

      if (totalCount === 0) return { total: 0, matchCount: 0, percent: 0, empty: true };
      const matchCount = typeCounts[personality] || 0;
      const percent = Math.round((matchCount / totalCount) * 100);
      return { total: totalCount, matchCount, percent };
    } catch (e) {
      console.warn('[StatsBackend] 获取同型占比失败:', e.message);
      return null;
    }
  }

  return { init, submitResult, getTestCount, getMatchStat };
})();
```

### 3. 修改 `app.js` 中的初始化

```javascript
// 旧代码：
// _statsReady = StatsBackend.init(VIKA_CONFIG);

// 新代码：
_statsReady = StatsBackend.init({ apiBase: STATS_API_BASE });
```

其他地方（`submitTestResult`、`fetchTestCount`、`fetchMatchStat`）**完全不用改**，因为 `StatsBackend` 的公共 API 接口（`submitResult`、`getTestCount`、`getMatchStat`）保持不变。

---

## 五、完整迁移清单

- [ ] 1. 注册飞书 → 创建自建应用 → 拿到 `App ID` + `App Secret`
- [ ] 2. 开通 `bitable:app` 权限 → 发布应用版本
- [ ] 3. 在飞书中创建多维表格 → 建好 4 列 → 拿到 `app_token` + `table_id`
- [ ] 4. 将应用添加为多维表格的协作者（编辑权限）
- [ ] 5. 注册 Cloudflare → 创建 Worker → 粘贴代码 → 配置环境变量 → 部署
- [ ] 6. 测试 Worker：访问 `/count` 确认返回正常
- [ ] 7. 修改 `app.js` 和 `stats-backend.js` → 部署前端
- [ ] 8. 完成一次测试 → 检查飞书多维表格是否有新数据

---

## 六、费用对比

| 项目 | 维格表（当前） | 飞书 + CF Worker（迁移后） |
|------|-------------|--------------------------|
| 数据收集 API | 1 万次/月 | **100 万次/月** |
| 中转服务 | 不需要 | CF Worker 免费 10 万次/天 |
| 月费 | ¥0 | **¥0** |
| 日活上限（估） | ~330 人/天 | ~33,000 人/天 |

---

## 七、常见问题

### Q: Worker 返回 403 / 权限不足？
- 检查是否已将应用添加为多维表格的**文档协作者**
- 检查应用是否已**发布版本**且权限已生效

### Q: 飞书文本字段返回格式奇怪？
- 飞书的「文本」字段可能返回富文本结构 `[{"type":"text","text":"SOUL"}]`
- Worker 代码中已做兼容处理

### Q: Cloudflare Worker 免费版够用吗？
- 免费版每天 **10 万次请求**，即使日活 1 万人（每人 2-3 次请求）也只有 2-3 万次
- 完全够用

### Q: 能不能不用 Cloudflare Worker？
- 可以用任何 Serverless 平台替代：Vercel Edge Functions、腾讯云函数、阿里云函数计算
- 也可以用 Deno Deploy（免费 10 万次/月）
- 核心逻辑一样：服务端管理 Token + 代理请求

### Q: 旧数据怎么迁移？
- 从维格表导出 CSV → 在飞书多维表格中导入
- 或者用脚本批量读取维格表 → 写入飞书

---

## 八、关键链接

| 名称 | 链接 |
|------|------|
| 飞书开放平台 | https://open.feishu.cn/ |
| 多维表格 API 概述 | https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview |
| 新增记录 API | https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/create |
| 列出记录 API | https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list |
| 获取 Token API | https://open.feishu.cn/document/server-docs/getting-started/api-access-guide |
| Cloudflare Workers | https://workers.cloudflare.com/ |
