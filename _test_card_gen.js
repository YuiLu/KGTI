/**
 * 模拟 saveImage() 生成卡片图片（Node.js 版本）
 * 使用 node-canvas 模拟浏览器 Canvas API
 */
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-generator');

// ---- 模拟数据（SOUL 人格） ----
const r = {
  personality: 'SOUL',
  info: {
    name: '本命',
    emoji: '📸',
    quote: '"Kig是生命的一部分，面具下才是完整的自己"',
    colors: { primary: '#ff6e40', secondary: '#dd2c00', accent: '#ffab91' },
    badgeColor: '#ff6e40'
  },
  modelScores: [88, 92, 78, 85, 95]
};

const MODEL_NAMES = ['生存力', '表现力', '社交力', '经济力', '认同心态'];

function hexToRGBA(hex, alpha) {
  const rv = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${rv},${g},${b},${alpha})`;
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

function drawRadarChart(ctx, cx, cy, maxR, scores, colors, labels) {
  const n = labels.length;

  // 背景网格
  for (let level = 1; level <= 4; level++) {
    const rv = (maxR / 4) * level;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      const x = cx + rv * Math.cos(angle);
      const y = cy + rv * Math.sin(angle);
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
  ctx.font = '13px sans-serif';
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

function _roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function generateCard() {
  const w = 600, h = 960;
  const canvas = createCanvas(w, h);
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
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KGTI · Kigurumi Type Indicator', w / 2, 40);

  // 头像
  try {
    const avatarImg = await loadImage(path.join(__dirname, 'assets', 'SOUL.png'));
    const boxX = (w - 220) / 2;
    const boxY = 60;
    const boxW = 220;
    const boxH = 220;
    const scale = Math.min(boxW / avatarImg.width, boxH / avatarImg.height);
    const drawW = avatarImg.width * scale;
    const drawH = avatarImg.height * scale;
    const dx = boxX + (boxW - drawW) / 2;
    const dy = boxY + (boxH - drawH) / 2;
    ctx.drawImage(avatarImg, dx, dy, drawW, drawH);
  } catch (e) {
    console.log('头像加载失败:', e.message);
  }

  // 人格类型
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = r.info.colors.primary;
  ctx.textAlign = 'center';
  ctx.fillText(r.personality, w / 2, 310);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`${r.info.emoji} ${r.info.name}`, w / 2, 340);

  // 宣言
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ff6090';
  wrapText(ctx, r.info.quote, w / 2, 380, w - 80, 20);

  // 雷达图（直接在主 canvas 上绘制）
  const radarCx = w / 2;
  const radarCy = 545;
  const radarR = 95;
  drawRadarChart(ctx, radarCx, radarCy, radarR, r.modelScores, r.info.colors, MODEL_NAMES);

  // ---- 底部区域：文字 + 两个二维码并排居中 ----
  const qrSize = 80;
  const qrGap = 40;         // 两个码之间的间距
  const qrPad = 4;          // 白底 padding
  const totalQrW = qrSize * 2 + qrGap;  // 两个码 + 间距总宽度
  const qrStartX = (w - totalQrW) / 2;  // 居中起始 X

  // 底部文字区域
  const textY = h - 190;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8888aa';
  ctx.font = '13px sans-serif';
  ctx.fillText('头壳之下，灵魂几何？', w / 2, textY);
  ctx.font = '11px sans-serif';
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

  // — 左码：网页二维码（白色圆角底 + 黑色模块） —
  const qr = qrcode(0, 'M');
  qr.addData('https://kgti.example.com');  // 模拟网页 URL
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
  ctx.font = '11px sans-serif';
  ctx.fillText('扫码测测你是哪种Kiger', qr1X + qrSize / 2, qrY + qrSize + 18);

  // — 右码：QQ 群二维码（白色圆角底 + 原图直接绘制）—
  const qr2X = qrStartX + qrSize + qrGap;
  try {
    const qqQrImg = await loadImage(path.join(__dirname, 'assets', 'QQGroupQRCode.png'));

    // 白色圆角背景
    ctx.fillStyle = '#ffffff';
    _roundRect(ctx, qr2X - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 6);
    ctx.fill();

    // 直接绘制原始 QQ 群二维码（不做反色，保持可扫描性）
    ctx.drawImage(qqQrImg, qr2X, qrY, qrSize, qrSize);

    // QQ 码下方文字
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666680';
    ctx.font = '11px sans-serif';
    ctx.fillText('扫码加入KGTI交流群', qr2X + qrSize / 2, qrY + qrSize + 18);
  } catch (e) {
    console.log('QQ 二维码加载失败:', e.message);
  }

  // 保存图片
  const outPath = path.join(__dirname, 'KGTI_SOUL_本命_test.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log('卡片已生成:', outPath);
  console.log('图片尺寸: 600x960');
}

generateCard().catch(e => console.error('生成失败:', e));
