/**
 * KGTI 数据收集与统计 —— 基于维格表 (Vika) REST API
 *
 * 功能：
 *   1. 提交测试结果（静默写入维格表）
 *   2. 获取测试总人数（读取记录总数）
 *   3. 获取同型占比（读取指定人格类型的比例）
 *
 * 维格表列设计（请在维格表中手动创建以下列）：
 *
 *   人格类型        (单行文本)  : 如 "SOUL"、"ROBO"
 *   五维分数        (单行文本)  : JSON 数组，如 "[78,65,42,55,80]"
 *   维度等级        (单行文本)  : JSON 数组，如 "[3,2,1,4,2,3,1,2,4,3,2,1]"
 *   提交时间        (单行文本)  : ISO 时间字符串
 *
 * 使用方式：
 *   StatsBackend.init({ token, datasheetId })
 *   StatsBackend.submitResult({ personality, modelScores, levels })
 *   StatsBackend.getTestCount()
 *   StatsBackend.getMatchStat(personality)
 */

const StatsBackend = (() => {

  /* ---------- 私有状态 ---------- */
  let _initialized = false;
  let _token = '';
  let _datasheetId = '';

  // 缓存统计数据，避免频繁请求（缓存 5 分钟）
  const CACHE_TTL = 5 * 60 * 1000;
  let _cache = {
    totalCount: { value: null, time: 0 },
    typeCounts: { value: null, time: 0 }
  };

  /* ---------- 通用请求工具 ---------- */
  function apiUrl(path) {
    return `https://api.vika.cn/fusion/v1/datasheets/${_datasheetId}${path}`;
  }

  function headers() {
    return {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json'
    };
  }

  /* ---------- 初始化 ---------- */
  function init({ token, datasheetId }) {
    if (_initialized) return true;

    if (!token || !datasheetId) {
      console.warn('[StatsBackend] 缺少 token 或 datasheetId，统计收集已禁用');
      return false;
    }

    _token = token;
    _datasheetId = datasheetId;
    _initialized = true;
    return true;
  }

  /* ---------- 提交测试结果 ---------- */
  async function submitResult({ personality, modelScores, levels }) {
    if (!_initialized) {
      console.warn('[StatsBackend] 未初始化，跳过提交');
      return { success: false };
    }

    const fields = {
      '人格类型': personality || '',
      '五维分数': JSON.stringify(modelScores || []),
      '维度等级': JSON.stringify(levels || []),
      '提交时间': new Date().toISOString()
    };

    const body = { records: [{ fields }] };

    try {
      const res = await fetch(apiUrl('/records'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        // 提交成功后清除缓存，下次读取会获取最新数据
        _cache.totalCount.time = 0;
        _cache.typeCounts.time = 0;
        return { success: true };
      } else {
        console.warn('[StatsBackend] 提交失败:', data.message || data.code);
        return { success: false };
      }
    } catch (e) {
      console.warn('[StatsBackend] 提交异常:', e.message);
      return { success: false };
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
      // 维格表 API: GET /records 支持 pageSize=1 获取 total
      const res = await fetch(apiUrl('/records?pageSize=1&fieldNames=' + encodeURIComponent('人格类型')), {
        method: 'GET',
        headers: headers()
      });

      const data = await res.json();

      if (data.success && data.data) {
        const total = data.data.total || 0;
        _cache.totalCount = { value: total, time: Date.now() };
        return total;
      }
      return null;
    } catch (e) {
      console.warn('[StatsBackend] 获取总数失败:', e.message);
      return null;
    }
  }

  /* ---------- 获取同型占比 ---------- */
  async function getMatchStat(personality) {
    if (!_initialized || !personality) return null;

    try {
      // 获取所有记录的人格类型（通过分页遍历统计）
      // 如果有缓存且未过期，直接使用
      let typeCounts = _cache.typeCounts.value;
      let totalCount = 0;

      if (typeCounts && Date.now() - _cache.typeCounts.time < CACHE_TTL) {
        // 使用缓存
        totalCount = Object.values(typeCounts).reduce((s, v) => s + v, 0);
      } else {
        // 重新拉取统计
        typeCounts = {};
        totalCount = 0;
        let pageNum = 1;
        const pageSize = 1000; // 维格表单次最多 1000 条
        let hasMore = true;

        while (hasMore) {
          const url = apiUrl(`/records?pageSize=${pageSize}&pageNum=${pageNum}&fieldNames=` + encodeURIComponent('人格类型'));
          const res = await fetch(url, {
            method: 'GET',
            headers: headers()
          });

          const data = await res.json();

          if (!data.success || !data.data || !data.data.records) {
            hasMore = false;
            break;
          }

          const records = data.data.records;
          records.forEach(r => {
            const type = r.fields && r.fields['人格类型'];
            if (type) {
              typeCounts[type] = (typeCounts[type] || 0) + 1;
              totalCount++;
            }
          });

          // 检查是否还有下一页
          if (records.length < pageSize) {
            hasMore = false;
          } else {
            pageNum++;
          }
        }

        // 更新缓存
        _cache.typeCounts = { value: typeCounts, time: Date.now() };
        _cache.totalCount = { value: totalCount, time: Date.now() };
      }

      if (totalCount === 0) return { total: 0, matchCount: 0, percent: 0, empty: true };

      const matchCount = typeCounts[personality] || 0;
      const percent = Math.round((matchCount / totalCount) * 100);

      return {
        total: totalCount,
        matchCount,
        percent
      };
    } catch (e) {
      console.warn('[StatsBackend] 获取同型占比失败:', e.message);
      return null;
    }
  }

  /* ---------- 暴露公共 API ---------- */
  return {
    init,
    submitResult,
    getTestCount,
    getMatchStat
  };

})();
