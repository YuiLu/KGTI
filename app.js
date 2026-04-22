/**
 * KGTI 主应用逻辑
 */

let currentQuestions = [];
let currentIndex = 0;
let answers = [];

// ---- 工具函数 ----
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- 雷达图绘制 ----
function drawRadarChart(canvasId, scores, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(cx, cy) - 40;
  const labels = ['生存力', '表现力', '社交力', '经济力'];
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
  document.getElementById('btn-prev').disabled = currentIndex === 0;
  document.getElementById('btn-skip').textContent =
    currentIndex === total - 1 ? '提交 →' : '跳过 →';

  // 卡片动画
  const card = document.getElementById('question-card');
  card.style.animation = 'none';
  void card.offsetHeight;
  card.style.animation = 'slideInUp 0.4s ease';
}

// ---- 选择选项 ----
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

  // 延迟进入下一题
  setTimeout(() => {
    if (currentIndex < currentQuestions.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      submitTest();
    }
  }, 350);
}

// ---- 上一题 ----
function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

// ---- 跳过 ----
function skipQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    submitTest();
  }
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

// ---- 显示结果 ----
function showResult() {
  const rawScores = calculateRawScores(answers, currentQuestions);
  const levels = scoresToLevels(rawScores);
  const personality = matchPersonality(levels);
  const modelScores = calcModelScores(rawScores);
  const info = PERSONALITY_INFO[personality];

  // 类型标题
  document.getElementById('result-type').textContent = personality;
  document.getElementById('result-name').textContent =
    `${info.emoji} ${info.name}（${info.category}）`;

  // 宣言
  document.getElementById('result-quote').textContent = info.quote;

  // 描述
  document.getElementById('result-desc').textContent = info.desc;

  // 徽章
  const badge = document.getElementById('result-badge');
  badge.textContent = info.category;
  badge.style.background = hexToRGBA(info.badgeColor, 0.2);
  badge.style.color = info.badgeColor;
  badge.style.border = `1px solid ${hexToRGBA(info.badgeColor, 0.4)}`;

  // 设置头像图片
  document.getElementById('result-avatar').src = `assets/${personality}.png`;

  // 雷达图
  drawRadarChart('radar-canvas', modelScores, info.colors);

  // 维度标签
  const tagsEl = document.getElementById('dimension-tags');
  tagsEl.innerHTML = '';
  DIM_NAMES.forEach((name, i) => {
    const levelLabel = ['低', '中', '高'][levels[i]];
    const levelClass = levels[i] === 2 ? 'high' : levels[i] === 0 ? 'low' : '';
    const tag = document.createElement('span');
    tag.className = `dim-tag ${levelClass}`;
    tag.textContent = `${name}: ${levelLabel}`;
    tagsEl.appendChild(tag);
  });

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

// ---- 分享 ----
function shareResult() {
  const r = window.__kgtiResult;
  if (!r) return;

  const text = [
    `🎭 我的KGTI测试结果是：【${r.personality}】${r.info.name}！`,
    `${r.info.quote}`,
    '',
    `📊 四维属性：`,
    `  生存力 ${r.modelScores[0]} | 表现力 ${r.modelScores[1]}`,
    `  社交力 ${r.modelScores[2]} | 经济力 ${r.modelScores[3]}`,
    '',
    `🔗 来测测你是哪种Kiger → ${window.location.href}`,
    `#KGTI #Kigurumi人格测试`
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('share-toast');
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
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });
}

// ---- 保存结果图片 ----
function saveImage() {
  const r = window.__kgtiResult;
  if (!r) return;

  // 创建一个高分辨率 canvas 来合成结果图
  const w = 600, h = 800;
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
  ctx.fillText('KGTI · Kigurumi Generation Type Indicator', w / 2, 40);

  // 头像
  const avatarImg = document.getElementById('result-avatar');
  if (avatarImg && avatarImg.complete) {
    ctx.drawImage(avatarImg, (w - 200) / 2, 60, 200, 200);
  }

  // 人格类型
  ctx.font = 'bold 48px "Segoe UI", sans-serif';
  ctx.fillStyle = r.info.colors.primary;
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

  // 底部
  ctx.fillStyle = '#8888aa';
  ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('面具之下，灵魂几何？', w / 2, h - 40);
  ctx.fillText(window.location.href, w / 2, h - 20);

  // 下载
  const link = document.createElement('a');
  link.download = `KGTI_${r.personality}_${r.info.name}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
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

// ---- 重新测试 ----
function restartTest() {
  showPage('page-start');
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  // 随机测试人数
  const count = 8964 + Math.floor(Math.random() * 500);
  document.getElementById('test-count').textContent = count.toLocaleString();
});
