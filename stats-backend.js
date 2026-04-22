/**
 * KGTI 数据收集与统计 —— 基于 Supabase (PostgreSQL)
 *
 * 功能：
 *   1. 提交测试结果（写入 test_results 表）
 *   2. 记录用户行为事件（写入 user_events 表）
 *   3. 获取测试总人数
 *   4. 获取同型占比
 *
 * 数据库表：
 *   test_results  — 每次完成测试写入一条
 *   user_events   — 用户行为事件（分享、保存图片、停留等）
 *
 * 使用方式：
 *   StatsBackend.init({ supabaseUrl, supabaseKey })
 *   StatsBackend.submitResult({ personality, modelScores, levels })
 *   StatsBackend.trackEvent(eventType, eventData)
 *   StatsBackend.getTestCount()
 *   StatsBackend.getMatchStat(personality)
 */

const StatsBackend = (() => {

  /* ---------- 私有状态 ---------- */
  let _initialized = false;
  let _supabase = null;   // Supabase client 实例
  let _sessionId = '';     // 当前会话的匿名标识
  let _env = 'prod';      // 当前环境: 'prod' | 'dev'

  // 缓存统计数据，避免频繁请求（缓存 5 分钟）
  const CACHE_TTL = 5 * 60 * 1000;
  let _cache = {
    totalCount: { value: null, time: 0 },
    typeCounts: { value: null, time: 0 }
  };

  /* ---------- 工具函数 ---------- */

  /**
   * 生成或恢复匿名 session ID
   * 存在 localStorage 中，同一设备/浏览器保持一致
   */
  function getOrCreateSessionId() {
    const KEY = 'kgti:sessionId';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  /**
   * 获取当前用户的测试序号（第几次测试）
   */
  function getTestNumber() {
    const KEY = 'kgti:testNumber';
    let n = parseInt(localStorage.getItem(KEY) || '0', 10);
    n++;
    localStorage.setItem(KEY, String(n));
    return n;
  }

  /**
   * 从 URL 中提取 utm_source 参数
   */
  function getUtmSource() {
    try {
      return new URLSearchParams(window.location.search).get('utm_source') || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * 获取屏幕尺寸
   */
  function getScreenSize() {
    return `${window.screen.width}x${window.screen.height}`;
  }

  /**
   * 自动检测当前环境
   * - EdgeOne Pages 的 preview 部署 URL 包含 commit hash 子域名
   * - 本地开发（localhost / 127.0.0.1 / file://）也视为 dev
   * - 其他情况视为 prod
   */
  function detectEnv() {
    const host = window.location.hostname;
    // 本地开发
    if (host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:') {
      return 'dev';
    }
    // URL 参数强制指定
    try {
      const forced = new URLSearchParams(window.location.search).get('env');
      if (forced === 'dev' || forced === 'prod') return forced;
    } catch (_) {}
    // EdgeOne Pages preview 环境: <hash>.<project>.pages.dev
    // 正式环境只有一层子域名: <project>.pages.dev 或自定义域名
    const parts = host.split('.');
    if (host.endsWith('.pages.dev') && parts.length > 3) {
      return 'dev'; // preview 部署
    }
    return 'prod';
  }

  /* ---------- 初始化 ---------- */
  function init({ supabaseUrl, supabaseKey }) {
    if (_initialized) return true;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[StatsBackend] 缺少 supabaseUrl 或 supabaseKey，统计收集已禁用');
      return false;
    }

    // 检查 Supabase SDK 是否已加载
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.warn('[StatsBackend] Supabase SDK 未加载');
      return false;
    }

    try {
      _supabase = supabase.createClient(supabaseUrl, supabaseKey);
      _sessionId = getOrCreateSessionId();
      _env = detectEnv();
      _initialized = true;
      console.log(`[StatsBackend] 初始化成功 (env: ${_env})`);

      // 初始化时记录一次页面访问
      trackEvent('page_view', {
        url: window.location.href,
        referrer: document.referrer || null,
        utm_source: getUtmSource()
      });

      return true;
    } catch (e) {
      console.warn('[StatsBackend] Supabase 初始化失败:', e.message);
      return false;
    }
  }

  /* ---------- 提交测试结果 ---------- */
  async function submitResult({ personality, modelScores, levels }) {
    if (!_initialized) {
      console.warn('[StatsBackend] 未初始化，跳过提交');
      return { success: false };
    }

    const record = {
      session_id: _sessionId,
      personality: personality || '',
      model_scores: modelScores || [],
      levels: levels || [],
      test_number: getTestNumber(),
      referrer: document.referrer || null,
      utm_source: getUtmSource(),
      user_agent: navigator.userAgent || null,
      screen_size: getScreenSize(),
      env: _env
    };

    try {
      const { error } = await _supabase
        .from('test_results')
        .insert([record]);

      if (error) {
        console.warn('[StatsBackend] 提交失败:', error.message);
        return { success: false };
      }

      // 提交成功后清除缓存
      _cache.totalCount.time = 0;
      _cache.typeCounts.time = 0;

      // 同时记录一个 test_complete 事件
      trackEvent('test_complete', { personality });

      return { success: true };
    } catch (e) {
      console.warn('[StatsBackend] 提交异常:', e.message);
      return { success: false };
    }
  }

  /* ---------- 记录用户行为事件 ---------- */
  async function trackEvent(eventType, eventData = null) {
    if (!_initialized) return;

    try {
      await _supabase
        .from('user_events')
        .insert([{
          session_id: _sessionId,
          event_type: eventType,
          event_data: eventData,
          env: _env
        }]);
    } catch (_) {
      // 行为追踪静默失败，不影响主流程
    }
  }

  /* ---------- 获取测试总人数 ---------- */
  async function getTestCount() {
    if (!_initialized) return null;

    // 检查缓存
    if (_cache.totalCount.value !== null && Date.now() - _cache.totalCount.time < CACHE_TTL) {
      return _cache.totalCount.value;
    }

    try {
      // 统计 prod 环境的数据（不包含 dev 测试数据）
      const { count, error } = await _supabase
        .from('test_results')
        .select('*', { count: 'exact', head: true })
        .eq('env', 'prod');

      if (error) {
        console.warn('[StatsBackend] 获取总数失败:', error.message);
        return null;
      }

      _cache.totalCount = { value: count, time: Date.now() };
      return count;
    } catch (e) {
      console.warn('[StatsBackend] 获取总数异常:', e.message);
      return null;
    }
  }

  /* ---------- 获取同型占比 ---------- */
  async function getMatchStat(personality) {
    if (!_initialized || !personality) return null;

    try {
      let typeCounts = _cache.typeCounts.value;
      let totalCount = 0;

      if (typeCounts && Date.now() - _cache.typeCounts.time < CACHE_TTL) {
        totalCount = Object.values(typeCounts).reduce((s, v) => s + v, 0);
      } else {
        // 使用 Supabase 的 RPC 或逐类型 count
        // 简单方案：查询所有人格类型的计数
        typeCounts = {};
        totalCount = 0;

        const TYPES = ['ROBO', 'PURE', 'SEXY', 'FAKE', 'HIDE', 'SHOW', 'RICH', 'SOUL'];

        // 并行查询所有类型的计数（只统计 prod 环境）
        const queries = TYPES.map(type =>
          _supabase
            .from('test_results')
            .select('*', { count: 'exact', head: true })
            .eq('personality', type)
            .eq('env', 'prod')
        );

        const results = await Promise.all(queries);

        results.forEach((res, i) => {
          const c = res.count || 0;
          typeCounts[TYPES[i]] = c;
          totalCount += c;
        });

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

  /* ---------- 暴露公共 API ---------- */
  return {
    init,
    submitResult,
    trackEvent,
    getTestCount,
    getMatchStat,
    /** 获取当前 session ID（供外部使用） */
    getSessionId: () => _sessionId,
    /** 获取当前环境标识（供外部使用） */
    getEnv: () => _env
  };

})();
