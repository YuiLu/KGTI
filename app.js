/**
 * KGTI 主应用逻辑
 */

let currentQuestions = [];
let currentIndex = 0;
let answers = [];
let hasCountedCurrentRun = false;
const LAST_RESULT_KEY = 'kgti:lastResult';

// ---- Supabase 数据收集配置 ----
const SUPABASE_CONFIG = {
  supabaseUrl: 'https://hiuhfieznrvuquxkooao.supabase.co',
  supabaseKey: 'sb_publishable_C2LxRpiSRyeEZrhu7HKkfQ_YvesOoH2'
};
const FALLBACK_TEST_COUNT = 0;

// 是否已成功初始化后端
let _statsReady = false;

// ---- 工具函数 ----
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- 雷达图绘制 ----
function drawRadarChart(canvasId, scores, colors, labels = MODEL_NAMES) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(cx, cy) - 60;
  const n = labels.length;

  ctx.clearRect(0, 0, w, h);

  // 背景网格
  for (let level = 1; level <= 4; level++) {
    const r = (maxR / 4) * level;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 轴线
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();
  }

  // 数据区域
  ctx.beginPath();
  scores.forEach((score, i) => {
    const val = Math.max(0, Math.min(100, score)) / 100;
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const x = cx + maxR * val * Math.cos(angle);
    const y = cy + maxR * val * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(colors.primary, 0.25);
  ctx.fill();
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 数据点
  scores.forEach((score, i) => {
    const val = Math.max(0, Math.min(100, score)) / 100;
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const x = cx + maxR * val * Math.cos(angle);
    const y = cy + maxR * val * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.primary;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 标签
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#c0c0d0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, i) => {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const lr = maxR + 24;
    const x = cx + lr * Math.cos(angle);
    const y = cy + lr * Math.sin(angle);
    ctx.fillText(`${label} ${scores[i]}`, x, y);
  });
}

// ---- 页面管理 ----
function showPage(pageId) {
  // 如果正在离开结果页，上报停留时长
  if (window.__resultPageEnterTime && pageId !== 'page-result') {
    const staySeconds = Math.round((Date.now() - window.__resultPageEnterTime) / 1000);
    StatsBackend.trackEvent('result_stay', { seconds: staySeconds });
    window.__resultPageEnterTime = null;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    page.style.animation = 'none';
    // 触发 reflow
    void page.offsetHeight;
    page.style.animation = 'fadeIn 0.5s ease';
  }
}

// ---- 开始测试 ----
function startTest() {
  currentQuestions = pickQuestions();
  currentIndex = 0;
  answers = [];
  hasCountedCurrentRun = false;
  StatsBackend.trackEvent('test_start');
  showPage('page-quiz');
  renderQuestion();
}

// ---- 渲染题目 ----
function renderQuestion() {
  const q = currentQuestions[currentIndex];
  const total = currentQuestions.length;

  document.getElementById('progress-fill').style.width =
    ((currentIndex / total) * 100) + '%';
  document.getElementById('progress-text').textContent =
    `${currentIndex + 1}/${total}`;

  document.getElementById('q-number').textContent = `Q${currentIndex + 1}`;
  document.getElementById('q-text').textContent = q.text;

  const optionsEl = document.getElementById('q-options');
  optionsEl.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';

    // 检查是否已经选过
    const existing = answers.find(a => a.questionId === q.id);
    if (existing && existing.optionIndex === idx) {
      btn.classList.add('selected');
    }

    btn.innerHTML = `<span class="option-label">${opt.label}</span><span>${opt.text}</span>`;
    btn.onclick = () => selectOption(idx);
    optionsEl.appendChild(btn);
  });

  // 导航按钮状态
  updateNavButtons(q.id, total);

  // 卡片动画
  const card = document.getElementById('question-card');
  card.style.animation = 'none';
  void card.offsetHeight;
  card.style.animation = 'slideInUp 0.4s ease';
}

// ---- 选择选项 ----
let _autoNextTimer = null;

function selectOption(idx) {
  const q = currentQuestions[currentIndex];

  // 更新/记录答案
  const existIdx = answers.findIndex(a => a.questionId === q.id);
  if (existIdx >= 0) {
    answers[existIdx].optionIndex = idx;
  } else {
    answers.push({ questionId: q.id, optionIndex: idx });
  }

  // 高亮选中
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === idx);
  });

  updateNavButtons(q.id, currentQuestions.length);

  // 选择后自动跳转下一题（短暂延迟让用户看到选中效果）
  if (_autoNextTimer) clearTimeout(_autoNextTimer);
  _autoNextTimer = setTimeout(() => {
    _autoNextTimer = null;
    nextQuestion();
  }, 350);
}

// ---- 上一题 ----
function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

// ---- 下一题 ----
function nextQuestion() {
  const q = currentQuestions[currentIndex];
  const hasAnswer = answers.some(a => a.questionId === q.id);
  if (!hasAnswer) return;

  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    submitTest();
  }
}

function updateNavButtons(questionId, total) {
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = currentIndex === 0;
  const hasAnswer = answers.some(a => a.questionId === questionId);
  nextBtn.disabled = !hasAnswer;
  nextBtn.textContent = currentIndex === total - 1 ? '提交 →' : '下一题 →';
}

// ---- 提交测试 ----
function submitTest() {
  showPage('page-loading');

  let progress = 0;
  const loadingBar = document.getElementById('loading-bar-fill');
  const loadingTexts = [
    '正在解析你的Kig灵魂...',
    '正在拆解面具下的人格...',
    '正在计算12维度向量...',
    '正在匹配Kig人格原型...',
    '即将揭晓结果...'
  ];

  const interval = setInterval(() => {
    progress += 2 + Math.random() * 3;
    if (progress > 100) progress = 100;
    loadingBar.style.width = progress + '%';

    // 更新加载文字
    const textIdx = Math.min(
      Math.floor(progress / 25),
      loadingTexts.length - 1
    );
    document.querySelector('.loading-text').textContent = loadingTexts[textIdx];

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(showResult, 500);
    }
  }, 80);
}

function renderResultView(personality, levels, modelScores) {
  const info = PERSONALITY_INFO[personality];
  if (!info) return;

  // 类型标题
  document.getElementById('result-type').textContent = personality;
  document.getElementById('result-name').textContent =
    `${info.emoji} ${info.name}`;

  // 宣言
  document.getElementById('result-quote').textContent = info.quote;

  // 描述
  document.getElementById('result-desc').textContent = info.desc;

  // 设置头像图片
  document.getElementById('result-avatar').src = `assets/${personality}.png`;

  // 雷达图
  drawRadarChart('radar-canvas', modelScores, info.colors, MODEL_NAMES);

  // 结果卡片背景色微调
  const card = document.getElementById('result-card');
  card.style.borderColor = hexToRGBA(info.badgeColor, 0.3);

  showPage('page-result');

  // 缓存结果用于分享
  window.__kgtiResult = {
    personality,
    info,
    modelScores,
    levels
  };
}

// ---- 显示结果 ----
function showResult() {
  const rawScores = calculateRawScores(answers, currentQuestions);
  const levels = scoresToLevels(rawScores);
  const personality = matchPersonality(levels);
  const modelScores = calcModelScores(rawScores, answers, currentQuestions);

  renderResultView(personality, levels, modelScores);

  // 记录进入结果页的时间，用于计算停留时长
  window.__resultPageEnterTime = Date.now();

  // 加载同型占比
  setMatchStatLoading(personality);
  fetchMatchStat(personality);

  // 缓存上次结果，便于调试时直达结果页
  localStorage.setItem(LAST_RESULT_KEY, JSON.stringify({
    personality,
    modelScores,
    levels
  }));

  if (!hasCountedCurrentRun) {
    hasCountedCurrentRun = true;
    submitTestResult(personality, modelScores, levels);
  }
}

// ---- 同型占比 ----
function setMatchStatLoading(personality) {
  const el = document.getElementById('match-stat');
  if (!el) return;
  el.textContent = `正在读取与你同为 ${personality} 的占比数据...`;
}

function setMatchStatText(text) {
  const el = document.getElementById('match-stat');
  if (!el) return;
  el.textContent = text;
}

async function fetchMatchStat(personality) {
  if (!_statsReady) {
    setMatchStatText('');
    return;
  }

  try {
    const data = await StatsBackend.getMatchStat(personality);

    if (!data || data.percent === undefined) {
      setMatchStatText('暂时无法获取同型占比，请稍后重试。');
      return;
    }

    if (data.empty) {
      // 维格表刚建好还没有数据，显示友好提示
      setMatchStatText('你是第一位完成测试的 Kiger，快邀请朋友一起来测吧！');
      return;
    }

    const info = PERSONALITY_INFO[personality];
    const typeName = info ? info.name : personality;
    setMatchStatText(`当前共有 ${data.percent}% 的 Kiger 与你同为 ${personality}（${typeName}）人格`);
  } catch (_) {
    setMatchStatText('暂时无法连接统计服务。');
  }
}

function buildShareText(r) {
  return [
    `🎭 我的KGTI测试结果是：【${r.personality}】${r.info.name}！`,
    `${r.info.quote}`,
    '',
    `📊 五维属性：`,
    `  生存力 ${r.modelScores[0]} | 表现力 ${r.modelScores[1]}`,
    `  社交力 ${r.modelScores[2]} | 经济力 ${r.modelScores[3]}`,
    `  认同心态 ${r.modelScores[4]}`,
    '',
    `🔗 来测测你是哪种Kiger → ${window.location.href}`,
    `#KGTI #Kigurumi人格测试`
  ].join('\n');
}

// ---- 分享结果 ----
async function shareResult() {
  const r = window.__kgtiResult;
  if (!r) return;

  // 统一记录分享按钮点击（用于统计分享率）
  StatsBackend.trackEvent('share_click', { personality: r.personality, method: 'share' });

  const text = buildShareText(r);

  if (navigator.share) {
    try {
      StatsBackend.trackEvent('share_native', { personality: r.personality });
      await navigator.share({
        title: `我的KGTI结果：${r.personality}`,
        text,
        url: window.location.href
      });
      return;
    } catch (_) {
      // 用户取消分享时静默处理，继续提供复制兜底
    }
  }

  await copyShareText();
}

// ---- 复制分享文案 ----
async function copyShareText() {
  const r = window.__kgtiResult;
  if (!r) return;

  StatsBackend.trackEvent('share_click', { personality: r.personality, method: 'copy' });
  StatsBackend.trackEvent('share_copy', { personality: r.personality });
  const text = buildShareText(r);

  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('share-toast');
    toast.textContent = '已复制分享文案！';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }).catch(() => {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const toast = document.getElementById('share-toast');
    toast.textContent = '已复制分享文案！';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });
}

// ---- 保存结果图片 ----
function saveImage() {
  const r = window.__kgtiResult;
  if (!r) return;

  StatsBackend.trackEvent('share_click', { personality: r.personality, method: 'save_image' });
  StatsBackend.trackEvent('save_image', { personality: r.personality });

  // 预加载 QQ 群二维码图片，然后合成卡片
  const qqQrImg = new Image();
  qqQrImg.crossOrigin = 'anonymous';
  qqQrImg.onload = () => _generateCard(r, qqQrImg);
  qqQrImg.onerror = () => _generateCard(r, null);
  qqQrImg.src = 'assets/QQGroupQRCode.png';
}

function _generateCard(r, qqQrImg) {
  const w = 600, h = 960;  // 增加高度容纳 QQ 群二维码
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);

  // 渐变装饰
  const g1 = ctx.createRadialGradient(100, 200, 0, 100, 200, 300);
  g1.addColorStop(0, hexToRGBA(r.info.colors.primary, 0.1));
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // 顶部标题
  ctx.fillStyle = '#8888aa';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('KGTI · Kigurumi Type Indicator', w / 2, 40);

  // 头像
  const avatarImg = document.getElementById('result-avatar');
  if (avatarImg && avatarImg.complete) {
    const boxX = (w - 220) / 2;
    const boxY = 60;
    const boxW = 220;
    const boxH = 220;
    const scale = Math.min(boxW / avatarImg.naturalWidth, boxH / avatarImg.naturalHeight);
    const drawW = avatarImg.naturalWidth * scale;
    const drawH = avatarImg.naturalHeight * scale;
    const dx = boxX + (boxW - drawW) / 2;
    const dy = boxY + (boxH - drawH) / 2;
    ctx.drawImage(avatarImg, dx, dy, drawW, drawH);
  }

  // 人格类型
  ctx.font = 'bold 48px "Segoe UI", sans-serif';
  ctx.fillStyle = r.info.colors.primary;
  ctx.textAlign = 'center';
  ctx.fillText(r.personality, w / 2, 310);

  ctx.font = '18px "Microsoft YaHei"';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`${r.info.emoji} ${r.info.name}`, w / 2, 340);

  // 宣言
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillStyle = '#ff6090';
  wrapText(ctx, r.info.quote, w / 2, 380, w - 80, 20);

  // 雷达图
  const radarCanvas = document.getElementById('radar-canvas');
  if (radarCanvas) {
    ctx.drawImage(radarCanvas, (w - 250) / 2, 420, 250, 250);
  }

  // ---- 底部区域：文字 + 两个二维码并排居中 ----
  const qrSize = 80;
  const qrGap = 40;         // 两个码之间的间距
  const qrPad = 4;          // 白底 padding
  const totalQrW = qrSize * 2 + qrGap;
  const qrStartX = (w - totalQrW) / 2;  // 居中起始 X

  // 底部文字
  const textY = h - 190;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8888aa';
  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillText('头壳之下，灵魂几何？', w / 2, textY);
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillStyle = '#666680';
  ctx.fillText('KGTI · Kigurumi人格测试', w / 2, textY + 20);

  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, textY + 34);
  ctx.lineTo(w - 40, textY + 34);
  ctx.stroke();

  const qrY = textY + 48;

  // 辅助：绘制圆角矩形
  function _roundRect(c, x, y, w2, h2, radius) {
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w2 - radius, y);
    c.quadraticCurveTo(x + w2, y, x + w2, y + radius);
    c.lineTo(x + w2, y + h2 - radius);
    c.quadraticCurveTo(x + w2, y + h2, x + w2 - radius, y + h2);
    c.lineTo(x + radius, y + h2);
    c.quadraticCurveTo(x, y + h2, x, y + h2 - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  // — 左码：网页链接二维码（白色圆角底 + 黑色模块）—
  try {
    const qr = qrcode(0, 'M');
    qr.addData(window.location.href);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const cellSize = qrSize / moduleCount;
    const qr1X = qrStartX;

    // 白色圆角背景
    ctx.fillStyle = '#ffffff';
    _roundRect(ctx, qr1X - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 6);
    ctx.fill();

    // 绘制 QR 模块（黑色）
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(qr1X + col * cellSize, qrY + row * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    // 网页码下方文字
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666680';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('扫码测测你是哪种Kiger', qr1X + qrSize / 2, qrY + qrSize + 18);
  } catch (_) {}

  // — 右码：QQ 群二维码（白色圆角底 + 原图直接绘制）—
  if (qqQrImg) {
    const qr2X = qrStartX + qrSize + qrGap;

    // 白色圆角背景
    ctx.fillStyle = '#ffffff';
    _roundRect(ctx, qr2X - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 6);
    ctx.fill();

    // 直接绘制原始 QQ 群二维码（不做反色，保持可扫描性）
    ctx.drawImage(qqQrImg, qr2X, qrY, qrSize, qrSize);

    // QQ 码下方文字
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666680';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('扫码加入KGTI交流群', qr2X + qrSize / 2, qrY + qrSize + 18);
  }

  // 下载
  const link = document.createElement('a');
  link.download = `KGTI_${r.personality}_${r.info.name}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// 绘制圆角矩形辅助函数
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = text.split('');
  let line = '';
  let ly = y;
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, ly);
      line = chars[i];
      ly += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, ly);
}

// ---- QQ 群二维码弹窗 ----
function toggleQQGroupModal() {
  const modal = document.getElementById('qq-group-modal');
  if (!modal) return;
  const isShow = modal.classList.contains('show');
  if (isShow) {
    modal.classList.remove('show');
  } else {
    modal.classList.add('show');
    StatsBackend.trackEvent('qq_group_view', { source: 'result_page' });
  }
}

function closeQQGroupModal(event, force) {
  const modal = document.getElementById('qq-group-modal');
  if (!modal) return;
  // 点击遮罩层关闭，或点击关闭按钮强制关闭
  if (force || event.target === modal) {
    modal.classList.remove('show');
  }
}

// ---- 重新测试 ----
function restartTest() {
  StatsBackend.trackEvent('retest');
  showPage('page-start');
}

// ---- 查看上次结果（缓存恢复） ----
function viewLastResult() {
  const restored = showCachedResultIfAny();
  if (restored) {
    StatsBackend.trackEvent('view_cached_result');
    // 加载同型占比
    const r = window.__kgtiResult;
    if (r) {
      setMatchStatLoading(r.personality);
      fetchMatchStat(r.personality);
    }
  }
}

function showDebugResultByType(type) {
  const personality = PERSONALITY_INFO[type] ? type : 'SOUL';
  const rawScores = PERSONALITY_VECTORS[personality]
    ? [...PERSONALITY_VECTORS[personality]]
    : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const levels = scoresToLevels(rawScores);
  const modelScores = calcModelScores(rawScores);
  renderResultView(personality, levels, modelScores);
}

function showCachedResultIfAny() {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !PERSONALITY_INFO[data.personality]) return false;
    if (!Array.isArray(data.levels) || !Array.isArray(data.modelScores)) return false;
    renderResultView(data.personality, data.levels, data.modelScores);
    return true;
  } catch (_) {
    return false;
  }
}

function setupDebugEntry() {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get('debug');
  const type = (params.get('type') || '').toUpperCase();

  // 用法：
  // ?debug=result           -> 展示上次缓存结果，没有缓存则 SOUL
  // ?debug=result&type=ROBO -> 直接展示指定人格
  if (debugMode === 'result') {
    if (type) {
      showDebugResultByType(type);
      return;
    }
    if (!showCachedResultIfAny()) {
      showDebugResultByType('SOUL');
    }
  }
}

function setupDebugHotkeys() {
  document.addEventListener('keydown', (e) => {
    // Shift + R: 快速进入上次结果页
    if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      if (!showCachedResultIfAny()) {
        showDebugResultByType('SOUL');
      }
    }
  });
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 Supabase 数据收集
  try {
    if (SUPABASE_CONFIG.supabaseUrl && SUPABASE_CONFIG.supabaseKey) {
      _statsReady = StatsBackend.init(SUPABASE_CONFIG);
    }
  } catch (e) {
    // 静默失败，不影响主流程
  }

  // 获取并展示测试人数
  fetchTestCount();
  setupDebugEntry();
  setupDebugHotkeys();

  // 如果有上次结果缓存，在开始页显示"查看上次结果"按钮
  try {
    const cached = localStorage.getItem(LAST_RESULT_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && PERSONALITY_INFO[data.personality]) {
        const btnWrap = document.getElementById('cached-result-wrap');
        if (btnWrap) btnWrap.style.display = 'block';
      }
    }
  } catch (_) {}

  // 页面关闭/刷新时上报结果页停留时长
  window.addEventListener('beforeunload', () => {
    if (window.__resultPageEnterTime) {
      const staySeconds = Math.round((Date.now() - window.__resultPageEnterTime) / 1000);
      // 使用 fetch + keepalive 确保页面关闭时也能发出请求
      // （sendBeacon 不支持自定义 header，而 Supabase REST API 需要 Authorization）
      const payload = JSON.stringify({
        session_id: StatsBackend.getSessionId(),
        event_type: 'result_stay',
        event_data: { seconds: staySeconds },
        env: StatsBackend.getEnv()
      });
      const url = SUPABASE_CONFIG.supabaseUrl + '/rest/v1/user_events';
      try {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.supabaseKey,
            'Authorization': 'Bearer ' + SUPABASE_CONFIG.supabaseKey,
            'Prefer': 'return=minimal'
          },
          body: payload,
          keepalive: true  // 关键：允许页面关闭后请求继续
        });
      } catch (_) {
        // 静默失败
      }
    }
  });
});

function setTestCountDisplay(count) {
  const el = document.getElementById('test-count');
  if (!el) return;
  const safeCount = Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : FALLBACK_TEST_COUNT;
  el.textContent = safeCount.toLocaleString();
}

// ---- 获取并展示测试人数 ----
async function fetchTestCount() {
  console.log('[KGTI] fetchTestCount called, _statsReady =', _statsReady);
  if (!_statsReady) {
    console.warn('[KGTI] StatsBackend 未就绪，显示 fallback:', FALLBACK_TEST_COUNT);
    setTestCountDisplay(FALLBACK_TEST_COUNT);
    return;
  }

  try {
    const count = await StatsBackend.getTestCount();
    console.log('[KGTI] getTestCount 返回:', count);
    setTestCountDisplay(count !== null ? (FALLBACK_TEST_COUNT + count) : FALLBACK_TEST_COUNT);
  } catch (e) {
    console.warn('[KGTI] fetchTestCount 异常:', e);
    setTestCountDisplay(FALLBACK_TEST_COUNT);
  }
}

/**
 * 提交测试结果到维格表（静默收集，不影响主流程）
 */
async function submitTestResult(personality, modelScores, levels) {
  if (!_statsReady) return;

  try {
    await StatsBackend.submitResult({
      personality,
      modelScores,
      levels
    });
    // 提交成功后刷新首页计数
    fetchTestCount();
  } catch (_) {
    // 数据收集失败不影响主流程
  }
}
