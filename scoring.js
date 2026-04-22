/**
 * KGTI 评分系统
 *
 * 12维度:
 *  0  穿脱独立度   1  工具利用率   2  意外抗性
 *  3  动作舒展度   4  镜头表现力   5  风格倾向性
 *  6  社死免疫力   7  圈内战斗力   8  互动值
 *  9  审美挑剔度  10  动手维护力  11  财力值
 *
 * 4 大模型（雷达图展示）:
 *  生存模型 = avg(0,1,2)
 *  表现模型 = avg(3,4,5)
 *  社交模型 = avg(6,7,8)
 *  经济模型 = avg(9,10,11)
 */

const DIM_NAMES = [
  '穿脱独立度', '工具利用率', '意外抗性',
  '动作舒展度', '镜头表现力', '风格倾向性',
  '社死免疫力', '圈内战斗力', '互动值',
  '审美挑剔度', '动手维护力', '财力值'
];

const MODEL_NAMES = ['生存力', '表现力', '社交力', '经济力'];

// 11 种人格原型的 12 维度向量 (L=0, M=1, H=2)
const PERSONALITY_VECTORS = {
  ROBO: [1,0,0, 0,0,0, 0,0,0, 0,1,0],
  PURE: [1,1,1, 1,1,0, 1,0,1, 1,1,0],
  SEXY: [1,1,1, 2,2,2, 1,0,1, 1,1,1],
  CHAR: [1,1,1, 2,2,1, 2,1,2, 1,1,1],
  FAKE: [2,2,1, 2,2,2, 1,1,1, 2,1,2],
  HIDE: [1,0,1, 0,0,0, 0,0,0, 1,1,0],
  SHOW: [1,1,1, 1,2,1, 2,1,2, 1,1,1],
  INVS: [1,0,0, 0,1,0, 0,0,0, 0,0,0],
  RICH: [1,1,1, 1,1,1, 1,1,1, 2,1,2],
  MONK: [0,0,1, 1,1,0, 1,0,1, 0,0,0],
  SOUL: [2,2,2, 2,2,2, 2,1,2, 2,2,2],
};

// 人格详情
const PERSONALITY_INFO = {
  ROBO: {
    name: '人机',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"人机本机，拍照只会剪刀手"',
    desc: '姿势僵硬、放不开，无角色代入感，典型镜头拘谨党。戴上面具的你就像一个刚开机还没下载驱动的机器人。',
    colors: { primary: '#78909c', secondary: '#455a64', accent: '#b0bec5' },
    badgeColor: '#78909c'
  },
  PURE: {
    name: '清水',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"只拍正片，涩涩达咩"',
    desc: '纯爱娃党，拒绝擦边，坚守清爽风格，圈中清流。你是Kig圈的一股清泉，用可爱治愈世界。',
    colors: { primary: '#4fc3f7', secondary: '#0288d1', accent: '#b3e5fc' },
    badgeColor: '#4fc3f7'
  },
  SEXY: {
    name: '烧娃',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"纯🔥🐔啊"',
    desc: '自信舒展，娃态撩人，天然镜头优势，自带致命吸引力。你是舞池中央最亮的那颗星。',
    colors: { primary: '#ef5350', secondary: '#c62828', accent: '#ff8a80' },
    badgeColor: '#ef5350'
  },
  CHAR: {
    name: '魅魔',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"行走榨汁机，要不要来玩点刺激的"',
    desc: '镜头感拉满，氛围感十足，一举一动自带娃圈吸引力，男女通吃。你是行走的氛围制造机。',
    colors: { primary: '#ab47bc', secondary: '#6a1b9a', accent: '#ea80fc' },
    badgeColor: '#ab47bc'
  },
  FAKE: {
    name: '伪人',
    category: '表现与风格派',
    emoji: '📸',
    quote: '"千头千面，风格切换毫无违和，拍啥都好看"',
    desc: '切换多种娃态，风格多变，适配不同角色，你根本猜不透面具下是谁。你是Kig界的演技派。',
    colors: { primary: '#7e57c2', secondary: '#4527a0', accent: '#b388ff' },
    badgeColor: '#7e57c2'
  },
  HIDE: {
    name: '社恐',
    category: '社交与活跃派',
    emoji: '🤝',
    quote: '"啊 今天跟人讲太多话有点累 我先回家了.jpg"',
    desc: '极度怕社死，不敢外拍，只在家变娃对着镜子自拍。你的Kig生涯=卧室写真集。',
    colors: { primary: '#90a4ae', secondary: '#546e7a', accent: '#cfd8dc' },
    badgeColor: '#90a4ae'
  },
  SHOW: {
    name: '社牛',
    category: '社交与活跃派',
    emoji: '🤝',
    quote: '"反正看不见本体，只要我不尴尬，尴尬的就是路人"',
    desc: '无惧路人目光，外拍大方，主动贴贴同好，漫展显眼包。你是每个娃聚的气氛担当。',
    colors: { primary: '#ffa726', secondary: '#e65100', accent: '#ffcc02' },
    badgeColor: '#ffa726'
  },
  INVS: {
    name: '小透明',
    category: '社交与活跃派',
    emoji: '🤝',
    quote: '"不混圈不社交不发帖，自娱自乐查无此人"',
    desc: '不混圈、不社交，独自变娃，低调到没存在感，自娱自乐。你是Kig界的独行侠。',
    colors: { primary: '#78909c', secondary: '#37474f', accent: '#b0bec5' },
    badgeColor: '#78909c'
  },
  RICH: {
    name: '富婆/少爷',
    category: '资源与心态派',
    emoji: '💰',
    quote: '"抱歉，有钱真的可以为所欲为"',
    desc: '多头多皮，极度抗拒量产克隆人，舍得投入，吃土也要定制拉满的财力玩家。',
    colors: { primary: '#ffd54f', secondary: '#f9a825', accent: '#fff176' },
    badgeColor: '#ffd54f'
  },
  MONK: {
    name: '高僧',
    category: '资源与心态派',
    emoji: '💰',
    quote: '"娃是不变的，头是吃灰的，毛是不理的，图是不修的"',
    desc: '佛系玩娃，拒绝内卷，头壳吃灰也无所谓，爱好而已不用较真。你是Kig界的世外高人。',
    colors: { primary: '#a5d6a7', secondary: '#388e3c', accent: '#c8e6c9' },
    badgeColor: '#a5d6a7'
  },
  SOUL: {
    name: '本命',
    category: '隐藏人格',
    emoji: '🌟',
    quote: '"戴上头壳才是本体，答应咱变一辈子娃好吗"',
    desc: 'Kig为人生热爱，全情投入，熟练运用各类Kig工具，视为精神寄托。你不是在cosplay，你就是角色本身。',
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
  // 检查 SOUL 触发条件: 表现模型(3,4,5)全 H
  const performAll2 = levels[3] === 2 && levels[4] === 2 && levels[5] === 2;
  if (performAll2) return 'SOUL';

  let bestType = 'MONK';
  let bestDist = Infinity;

  Object.entries(PERSONALITY_VECTORS).forEach(([type, vec]) => {
    if (type === 'SOUL') return; // SOUL only by special trigger
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
 * 计算 4 大模型分数 (0-100)
 */
function calcModelScores(rawScores) {
  return [
    Math.round(((rawScores[0] + rawScores[1] + rawScores[2]) / 6) * 100),
    Math.round(((rawScores[3] + rawScores[4] + rawScores[5]) / 6) * 100),
    Math.round(((rawScores[6] + rawScores[7] + rawScores[8]) / 6) * 100),
    Math.round(((rawScores[9] + rawScores[10] + rawScores[11]) / 6) * 100),
  ];
}
