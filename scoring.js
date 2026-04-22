/**
 * KGTI 评分系统
 *
 * 12维度:
 *  0  穿脱独立度   1  工具利用率   2  意外抗性
 *  3  动作舒展度   4  镜头表现力   5  风格倾向性
 *  6  社死免疫力   7  圈内战斗力   8  互动值
 *  9  审美挑剔度  10  动手维护力  11  财力值
 *
 * 5 大模型（雷达图展示）:
 *  生存模型 = avg(0,1,2)
 *  表现模型 = avg(3,4,5)
 *  社交模型 = avg(6,7,8)
 *  经济模型 = avg(9,10,11)
 *  认同心态模型 = 第5组场景题选项得分均值（不改题目，仅重构展示模型）
 */

const DIM_NAMES = [
  '穿脱独立度', '工具利用率', '意外抗性',
  '动作舒展度', '镜头表现力', '风格倾向性',
  '社死免疫力', '圈内战斗力', '互动值',
  '审美挑剔度', '动手维护力', '财力值'
];

const MODEL_NAMES = ['生存力', '表现力', '社交力', '经济力', '认同心态'];

// 8 种人格原型的 12 维度向量 (L=0, M=1, H=2)
const PERSONALITY_VECTORS = {
  ROBO: [0,0,0, 0,0,0, 0,0,0, 0,0,0],   // 全低：萌新/人机，啥都不会
  PURE: [1,1,1, 1,1,0, 1,0,1, 1,1,1],   // 中等生存+表现，清水风格，正常消费水平
  SEXY: [1,1,1, 2,2,2, 1,1,1, 1,1,1],   // 高表现+风格，烧娃
  FAKE: [2,2,1, 2,2,2, 1,1,1, 2,1,2],   // 高适应力+多变风格
  HIDE: [1,0,1, 0,0,0, 0,0,0, 0,1,0],   // 低社交全域，吸收原INVS空间
  SHOW: [1,1,1, 1,2,1, 2,2,2, 1,1,1],   // 高社交，漫展显眼包
  RICH: [1,1,1, 1,1,1, 0,0,1, 2,1,2],   // 高经济投入，审美高+财力高，社交偏低（闷声发大财）
  SOUL: [2,2,2, 2,2,2, 2,1,2, 2,2,2],   // 全高：本命Kiger
};

// 人格详情
const PERSONALITY_INFO = {
  ROBO: {
    name: '人机',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"人机本机，拍照只会剪刀手"',
    desc: '姿势僵硬、放不开，无角色代入感，面对镜头放不开',
    colors: { primary: '#78909c', secondary: '#455a64', accent: '#b0bec5' },
    badgeColor: '#78909c'
  },
  PURE: {
    name: '清水',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"只拍正片，涩涩达咩"',
    desc: '变娃只为了拍好看的照片，拒绝擦边',
    colors: { primary: '#4fc3f7', secondary: '#0288d1', accent: '#b3e5fc' },
    badgeColor: '#4fc3f7'
  },
  SEXY: {
    name: '烧娃',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"行走榨汁机，要不要来玩点刺激的"',
    desc: '镜头感拉满，氛围感十足，一举一动自带娃圈吸引力。',
    colors: { primary: '#ab47bc', secondary: '#6a1b9a', accent: '#ea80fc' },
    badgeColor: '#ab47bc'
  },
  FAKE: {
    name: '伪人',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"千头千面，风格切换毫无违和，拍啥都好看"',
    desc: '切换多种娃态，风格多变，适配不同角色，你根本猜不透面具下是谁。',
    colors: { primary: '#7e57c2', secondary: '#4527a0', accent: '#b388ff' },
    badgeColor: '#7e57c2'
  },
  HIDE: {
    name: '社恐',
    category: '社交与活跃派',
    emoji: '🤝',
    quote: '"啊 今天跟人讲太多话有点累 我先回家了.jpg"',
    desc: '极度怕社死，不敢外拍，不混圈，不社交，只在家变娃对着镜子自拍。',
    colors: { primary: '#90a4ae', secondary: '#546e7a', accent: '#cfd8dc' },
    badgeColor: '#90a4ae'
  },
  SHOW: {
    name: '社牛',
    category: '社交与活跃派',
    emoji: '🤝',
    quote: '"反正看不见本体，只要我不尴尬，尴尬的就是路人"',
    desc: '无惧路人目光，外拍大方，主动贴贴同好，漫展显眼包。',
    colors: { primary: '#ffa726', secondary: '#e65100', accent: '#ffcc02' },
    badgeColor: '#ffa726'
  },
  RICH: {
    name: '少爷',
    category: '资源与心态派',
    emoji: '💰',
    quote: '"抱歉，有钱真的可以为所欲为"',
    desc: '多头多皮，舍得投入，吃土也要定制拉满的财力玩家。',
    colors: { primary: '#ffd54f', secondary: '#f9a825', accent: '#fff176' },
    badgeColor: '#ffd54f'
  },
  SOUL: {
    name: '本命',
    category: '隐藏人格',
    emoji: '🌟',
    quote: '"戴上头壳才是本体，答应咱变一辈子娃好吗"',
    desc: 'Kig为人生热爱，全情投入，视为精神寄托。',
    colors: { primary: '#e040fb', secondary: '#aa00ff', accent: '#ea80fc' },
    badgeColor: '#e040fb'
  }
};

/**
 * 根据用户答案计算 12 维度得分
 * @param {Array} answers - [{questionId, optionIndex}]
 * @param {Array} questions - 当次抽到的题目
 * @returns {number[]} 12维度原始分
 */
function calculateRawScores(answers, questions) {
  const raw = new Array(12).fill(0);
  const counts = new Array(12).fill(0);

  answers.forEach(ans => {
    const q = questions.find(qq => qq.id === ans.questionId);
    if (!q) return;
    const opt = q.options[ans.optionIndex];
    if (!opt) return;
    Object.entries(opt.scores).forEach(([dim, val]) => {
      const d = parseInt(dim);
      raw[d] += val;
      counts[d]++;
    });
  });

  // 归一化到 0-2
  return raw.map((r, i) => {
    if (counts[i] === 0) return 1; // 默认中间值
    const avg = r / counts[i];
    return Math.min(2, Math.max(0, avg));
  });
}

/**
 * 将原始分转为 L/M/H 等级
 */
function scoresToLevels(scores) {
  return scores.map(s => {
    if (s < 0.67) return 0; // L
    if (s < 1.34) return 1; // M
    return 2;               // H
  });
}

/**
 * 曼哈顿距离匹配人格
 */
function matchPersonality(levels) {
  // 检查 SOUL 特殊触发: 表现模型(3,4,5)至少2项H + 生存模型(0,1,2)至少2项H + 经济模型(9,10,11)至少1项H
  const performHigh = [levels[3], levels[4], levels[5]].filter(v => v === 2).length >= 2;
  const surviveHigh = [levels[0], levels[1], levels[2]].filter(v => v === 2).length >= 2;
  const econHigh = [levels[9], levels[10], levels[11]].filter(v => v === 2).length >= 1;
  if (performHigh && surviveHigh && econHigh) return 'SOUL';

  // 普通距离匹配（SOUL 也参与，作为兜底路径）
  let bestType = 'ROBO';
  let bestDist = Infinity;

  Object.entries(PERSONALITY_VECTORS).forEach(([type, vec]) => {
    let dist = 0;
    for (let i = 0; i < 12; i++) {
      dist += Math.abs(levels[i] - vec[i]);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestType = type;
    }
  });

  return bestType;
}

/**
 * 从第5组场景题提炼“认同心态”模型 (0-100)
 * 不改题目本身，仅复用现有选项权重。
 */
function calcMindsetScore(rawScores, answers = [], questions = []) {
  const group5Means = [];

  answers.forEach(ans => {
    const q = questions.find(qq => qq.id === ans.questionId);
    if (!q || q.group !== 5) return;
    const opt = q.options[ans.optionIndex];
    if (!opt) return;
    const values = Object.values(opt.scores);
    if (!values.length) return;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    group5Means.push(mean);
  });

  if (group5Means.length > 0) {
    const avg = group5Means.reduce((sum, v) => sum + v, 0) / group5Means.length;
    return Math.round((avg / 2) * 100);
  }

  // 兜底：调试模式/旧缓存没有答案时，使用相关维度代理
  return Math.round(((rawScores[5] + rawScores[6] + rawScores[7] + rawScores[9] + rawScores[10]) / 10) * 100);
}

/**
 * 计算 5 大模型分数 (0-100)
 */
function calcModelScores(rawScores, answers = [], questions = []) {
  return [
    Math.round(((rawScores[0] + rawScores[1] + rawScores[2]) / 6) * 100),
    Math.round(((rawScores[3] + rawScores[4] + rawScores[5]) / 6) * 100),
    Math.round(((rawScores[6] + rawScores[7] + rawScores[8]) / 6) * 100),
    Math.round(((rawScores[9] + rawScores[10] + rawScores[11]) / 6) * 100),
    calcMindsetScore(rawScores, answers, questions),
  ];
}
