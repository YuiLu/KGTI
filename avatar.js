/**
 * KGTI 程序化 Low Poly Kig 头壳生成器
 * 为每种人格类型生成独特的 Kig 面具/头壳形象
 */

const AvatarGenerator = {
  /**
   * 在 Canvas 上绘制 Low Poly Kig 头壳
   */
  draw(canvasId, personalityType, size = 280) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const info = PERSONALITY_INFO[personalityType];
    const colors = info.colors;

    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;

    // 配色方案
    const baseColor = colors.primary;
    const darkColor = colors.secondary;
    const lightColor = colors.accent;

    // 随机种子来自人格类型名
    let seed = 0;
    for (let i = 0; i < personalityType.length; i++) {
      seed += personalityType.charCodeAt(i) * (i + 1);
    }
    const rng = mulberry32(seed);

    // ---- 背景光晕 ----
    const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.4);
    glow.addColorStop(0, hexToRGBA(baseColor, 0.15));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // ---- 头壳轮廓（圆润的椭圆形 Kig 面具） ----
    const headW = r * 1.05;
    const headH = r * 1.15;

    // 生成头壳轮廓点
    const outlinePoints = [];
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const angle = (Math.PI * 2 * i) / segments - Math.PI / 2;
      const wobble = 1 + (rng() - 0.5) * 0.06;
      const px = cx + Math.cos(angle) * headW * wobble;
      const py = cy + Math.sin(angle) * headH * wobble * (angle > 0 && angle < Math.PI ? 1.02 : 0.98);
      outlinePoints.push({ x: px, y: py });
    }

    // ---- Low Poly 三角面片填充 ----
    const innerPoints = [{ x: cx, y: cy }];
    // 添加一些内部随机点
    for (let i = 0; i < 20; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * r * 0.75;
      innerPoints.push({
        x: cx + Math.cos(angle) * dist * (headW / r),
        y: cy + Math.sin(angle) * dist * (headH / r)
      });
    }

    const allPoints = [...outlinePoints, ...innerPoints];

    // 简化的 Delaunay：使用中心扇形三角化 + 内部随机三角化
    const triangles = [];

    // 外轮廓扇形
    for (let i = 0; i < outlinePoints.length; i++) {
      const next = (i + 1) % outlinePoints.length;
      // 找最近的内部点
      let nearestIdx = 0;
      let nearestDist = Infinity;
      innerPoints.forEach((p, idx) => {
        const d = dist(outlinePoints[i], p);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = idx;
        }
      });
      triangles.push([
        outlinePoints[i],
        outlinePoints[next],
        innerPoints[nearestIdx]
      ]);
    }

    // 内部三角
    for (let i = 0; i < innerPoints.length; i++) {
      for (let j = i + 1; j < innerPoints.length; j++) {
        if (rng() > 0.4) continue;
        // 找第三个点
        let nearest = null;
        let nd = Infinity;
        allPoints.forEach(p => {
          if (p === innerPoints[i] || p === innerPoints[j]) return;
          const d = dist(innerPoints[i], p) + dist(innerPoints[j], p);
          if (d < nd) { nd = d; nearest = p; }
        });
        if (nearest) {
          triangles.push([innerPoints[i], innerPoints[j], nearest]);
        }
      }
    }

    // 绘制三角面片
    triangles.forEach(tri => {
      const centY = (tri[0].y + tri[1].y + tri[2].y) / 3;
      const relY = (centY - (cy - headH)) / (headH * 2);
      const shade = 0.6 + relY * 0.4 + (rng() - 0.5) * 0.15;

      ctx.beginPath();
      ctx.moveTo(tri[0].x, tri[0].y);
      ctx.lineTo(tri[1].x, tri[1].y);
      ctx.lineTo(tri[2].x, tri[2].y);
      ctx.closePath();

      ctx.fillStyle = shadeColor(baseColor, shade);
      ctx.fill();
      ctx.strokeStyle = shadeColor(darkColor, shade + 0.1);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // ---- Kig 特征：大眼睛 ----
    drawKigEyes(ctx, cx, cy, headW, headH, personalityType, colors, rng);

    // ---- 面具分割线 ----
    ctx.beginPath();
    ctx.moveTo(cx, cy - headH * 0.7);
    ctx.quadraticCurveTo(cx + 2, cy, cx, cy + headH * 0.8);
    ctx.strokeStyle = hexToRGBA(darkColor, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();

    // ---- 人格类型特殊装饰 ----
    drawPersonalityDecoration(ctx, cx, cy, r, personalityType, colors, rng);

    // ---- 外轮廓描边 ----
    ctx.beginPath();
    ctx.moveTo(outlinePoints[0].x, outlinePoints[0].y);
    for (let i = 1; i < outlinePoints.length; i++) {
      const prev = outlinePoints[i - 1];
      const curr = outlinePoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.closePath();
    ctx.strokeStyle = hexToRGBA(lightColor, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  /**
   * 绘制 Logo 动画头壳
   */
  drawLogo(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    const cx = size / 2;
    const cy = size / 2;
    const r = 70;

    // 渐变背景圆
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#e040fb');
    grad.addColorStop(1, '#7c4dff');

    // 简单的 Low Poly 面具
    const segments = 16;
    const points = [];
    for (let i = 0; i < segments; i++) {
      const a = (Math.PI * 2 * i) / segments - Math.PI / 2;
      points.push({
        x: cx + Math.cos(a) * r * (1 + (i % 3 === 0 ? 0.05 : -0.03)),
        y: cy + Math.sin(a) * r * 1.1
      });
    }

    // 面片
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[next].x, points[next].y);
      ctx.closePath();
      const shade = 0.7 + (i / segments) * 0.3;
      ctx.fillStyle = shadeColor('#9c27b0', shade);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 眼睛
    const eyeY = cy - r * 0.1;
    const eyeSpacing = r * 0.4;
    [cx - eyeSpacing, cx + eyeSpacing].forEach(ex => {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 12, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();
      // 高光
      ctx.beginPath();
      ctx.ellipse(ex + 3, eyeY - 4, 4, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    });

    // 嘴巴
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.3, r * 0.15, 0, Math.PI);
    ctx.strokeStyle = '#ff6090';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  /**
   * 加载动画
   */
  drawLoading(canvasId, progress) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 160;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    // 旋转的面具轮廓
    const angle = progress * Math.PI * 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * 0.1);

    const r = 50;
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const a = (Math.PI * 2 * i) / segments;
      const next = (Math.PI * 2 * (i + 1)) / segments;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(next) * r, Math.sin(next) * r);
      ctx.closePath();
      const alpha = 0.3 + (i / segments) * 0.7 * progress;
      ctx.fillStyle = `rgba(224,64,251,${alpha})`;
      ctx.fill();
    }

    ctx.restore();
  }
};

// ---- 辅助函数 ----

function drawKigEyes(ctx, cx, cy, headW, headH, type, colors, rng) {
  const eyeY = cy - headH * 0.12;
  const eyeSpacing = headW * 0.35;
  const eyeW = headW * 0.22;
  const eyeH = headH * 0.28;

  // 不同人格类型的眼睛形状
  const eyeStyles = {
    ROBO: { shape: 'dot', color: '#90a4ae' },
    PURE: { shape: 'round', color: '#4fc3f7' },
    SEXY: { shape: 'cat', color: '#ef5350' },
    CHAR: { shape: 'sharp', color: '#ea80fc' },
    FAKE: { shape: 'cross', color: '#b388ff' },
    HIDE: { shape: 'small', color: '#b0bec5' },
    SHOW: { shape: 'star', color: '#ffa726' },
    INVS: { shape: 'line', color: '#78909c' },
    RICH: { shape: 'diamond', color: '#ffd54f' },
    MONK: { shape: 'zen', color: '#a5d6a7' },
    SOUL: { shape: 'flame', color: '#e040fb' }
  };

  const style = eyeStyles[type] || eyeStyles.PURE;

  [cx - eyeSpacing, cx + eyeSpacing].forEach((ex, idx) => {
    ctx.save();

    switch (style.shape) {
      case 'round':
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        // 高光
        ctx.beginPath();
        ctx.ellipse(ex + eyeW * 0.2, eyeY - eyeH * 0.2, eyeW * 0.3, eyeH * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
        break;

      case 'dot':
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeW * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        break;

      case 'cat':
        ctx.beginPath();
        ctx.moveTo(ex - eyeW, eyeY);
        ctx.quadraticCurveTo(ex, eyeY - eyeH * 1.2, ex + eyeW, eyeY);
        ctx.quadraticCurveTo(ex, eyeY + eyeH * 0.6, ex - eyeW, eyeY);
        ctx.fillStyle = style.color;
        ctx.fill();
        // 竖瞳
        ctx.beginPath();
        ctx.ellipse(ex, eyeY - eyeH * 0.1, eyeW * 0.15, eyeH * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = colors.secondary;
        ctx.fill();
        break;

      case 'sharp':
        ctx.beginPath();
        ctx.moveTo(ex - eyeW, eyeY + eyeH * 0.2);
        ctx.lineTo(ex, eyeY - eyeH);
        ctx.lineTo(ex + eyeW, eyeY + eyeH * 0.2);
        ctx.lineTo(ex, eyeY + eyeH * 0.4);
        ctx.closePath();
        ctx.fillStyle = style.color;
        ctx.fill();
        break;

      case 'cross':
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex - eyeW * 0.6, eyeY - eyeH * 0.6);
        ctx.lineTo(ex + eyeW * 0.6, eyeY + eyeH * 0.6);
        ctx.moveTo(ex + eyeW * 0.6, eyeY - eyeH * 0.6);
        ctx.lineTo(ex - eyeW * 0.6, eyeY + eyeH * 0.6);
        ctx.stroke();
        break;

      case 'small':
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW * 0.4, eyeH * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        break;

      case 'star':
        drawStar(ctx, ex, eyeY, eyeW * 0.7, 5, style.color);
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(ex - eyeW, eyeY);
        ctx.lineTo(ex + eyeW, eyeY);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(ex, eyeY - eyeH);
        ctx.lineTo(ex + eyeW, eyeY);
        ctx.lineTo(ex, eyeY + eyeH);
        ctx.lineTo(ex - eyeW, eyeY);
        ctx.closePath();
        ctx.fillStyle = style.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;

      case 'zen':
        // 闭眼弧线
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeW * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;

      case 'flame':
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        const flameGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeW);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, style.color);
        flameGrad.addColorStop(1, colors.secondary);
        ctx.fillStyle = flameGrad;
        ctx.fill();
        // 光芒
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6 + rng() * 0.3;
          ctx.beginPath();
          ctx.moveTo(ex + Math.cos(a) * eyeW * 0.8, eyeY + Math.sin(a) * eyeH * 0.8);
          ctx.lineTo(ex + Math.cos(a) * eyeW * 1.4, eyeY + Math.sin(a) * eyeH * 1.4);
          ctx.strokeStyle = hexToRGBA(style.color, 0.5);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
    }

    ctx.restore();
  });
}

function drawPersonalityDecoration(ctx, cx, cy, r, type, colors, rng) {
  ctx.save();
  switch (type) {
    case 'ROBO':
      // 螺丝钉装饰
      [{ x: cx - r * 0.6, y: cy - r * 0.5 }, { x: cx + r * 0.6, y: cy - r * 0.5 }].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#b0bec5';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x - 3, p.y);
        ctx.lineTo(p.x + 3, p.y);
        ctx.strokeStyle = '#546e7a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      break;

    case 'PURE':
      // 头顶花朵
      drawFlower(ctx, cx, cy - r * 1.0, 12, colors.accent);
      break;

    case 'SEXY':
      // 火焰装饰
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.3 + (Math.PI * 0.6 * i) / 4;
        const fx = cx + Math.cos(a - Math.PI / 2) * r * 0.9;
        const fy = cy + Math.sin(a - Math.PI / 2) * r * 1.1;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + (rng() - 0.5) * 10, fy - 15 - rng() * 10, fx, fy - 20 - rng() * 15);
        ctx.strokeStyle = hexToRGBA('#ff6090', 0.6 + rng() * 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;

    case 'CHAR':
      // 恶魔角
      drawHorn(ctx, cx - r * 0.4, cy - r * 0.9, -0.3, colors.primary);
      drawHorn(ctx, cx + r * 0.4, cy - r * 0.9, 0.3, colors.primary);
      break;

    case 'FAKE':
      // 半面具裂纹
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx - 5, cy);
      ctx.lineTo(cx + 3, cy + r * 0.3);
      ctx.lineTo(cx - 2, cy + r * 0.6);
      ctx.strokeStyle = hexToRGBA(colors.accent, 0.5);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      break;

    case 'SHOW':
      // 皇冠
      drawCrown(ctx, cx, cy - r * 1.1, r * 0.5, colors.primary);
      break;

    case 'RICH':
      // 金币光环
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.8 + (Math.PI * 0.6 * i) / 4;
        const sx = cx + Math.cos(a) * r * 1.15;
        const sy = cy + Math.sin(a) * r * 1.15;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = hexToRGBA('#ffd54f', 0.4 + rng() * 0.4);
        ctx.fill();
      }
      break;

    case 'MONK':
      // 佛珠项链
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 0.15 + (Math.PI * 0.7 * i) / 7;
        const bx = cx + Math.cos(a) * r * 0.85;
        const by = cy + Math.sin(a) * r * 1.0;
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#a5d6a7';
        ctx.fill();
        ctx.strokeStyle = '#388e3c';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      break;

    case 'SOUL':
      // 光环
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 1.15, r * 0.35, r * 0.1, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
  }
  ctx.restore();
}

function drawStar(ctx, x, y, r, points, color) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawFlower(ctx, x, y, r, color) {
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.ellipse(
      x + Math.cos(a) * r * 0.5,
      y + Math.sin(a) * r * 0.5,
      r * 0.5, r * 0.3,
      a, 0, Math.PI * 2
    );
    ctx.fillStyle = hexToRGBA(color, 0.7);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff176';
  ctx.fill();
}

function drawHorn(ctx, x, y, lean, color) {
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 10);
  ctx.quadraticCurveTo(x + lean * 30, y - 25, x + lean * 15, y - 30);
  ctx.quadraticCurveTo(x + lean * 5, y - 15, x + 8, y + 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCrown(ctx, x, y, w, color) {
  ctx.beginPath();
  ctx.moveTo(x - w, y + 10);
  ctx.lineTo(x - w * 0.7, y - 5);
  ctx.lineTo(x - w * 0.3, y + 5);
  ctx.lineTo(x, y - 12);
  ctx.lineTo(x + w * 0.3, y + 5);
  ctx.lineTo(x + w * 0.7, y - 5);
  ctx.lineTo(x + w, y + 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * 绘制雷达图
 */
function drawRadarChart(canvasId, modelScores, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 300;
  canvas.width = size;
  canvas.height = size;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const labels = MODEL_NAMES;
  const n = labels.length;
  const angleStep = (Math.PI * 2) / n;

  // 背景网格
  for (let ring = 1; ring <= 4; ring++) {
    const r = maxR * (ring / 4);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = angleStep * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(255,255,255,${ring === 4 ? 0.15 : 0.06})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 轴线
  for (let i = 0; i < n; i++) {
    const a = angleStep * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 数据区域
  ctx.beginPath();
  modelScores.forEach((score, i) => {
    const a = angleStep * i - Math.PI / 2;
    const r = maxR * (score / 100);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(colors.primary, 0.2);
  ctx.fill();
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 数据点
  modelScores.forEach((score, i) => {
    const a = angleStep * i - Math.PI / 2;
    const r = maxR * (score / 100);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.primary;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 标签
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#8888aa';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const a = angleStep * i - Math.PI / 2;
    const lr = maxR + 24;
    const lx = cx + Math.cos(a) * lr;
    const ly = cy + Math.sin(a) * lr;
    ctx.fillText(`${label} ${modelScores[i]}`, lx, ly + 4);
  });
}

// ---- 工具函数 ----

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shadeColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r * factor));
  const ng = Math.min(255, Math.round(g * factor));
  const nb = Math.min(255, Math.round(b * factor));
  return `rgb(${nr},${ng},${nb})`;
}
