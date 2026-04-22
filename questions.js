/**
 * KGTI 完整题库 —— 25道题，每次随机抽取15道
 *
 * 每道题有 group（组别）和 scoring 数组。
 * scoring 里每个条目描述选项对哪个维度产生多少分。
 *
 * 维度索引:
 *  生存模型: 0-穿脱独立度  1-工具利用率  2-意外抗性
 *  表现模型: 3-动作舒展度  4-镜头表现力  5-风格倾向性
 *  社交模型: 6-社死免疫力  7-圈内战斗力  8-互动值
 *  经济模型: 9-审美挑剔度 10-动手维护力 11-财力值
 */

const FULL_QUESTIONS = [
  // ===== 第一组 (生存 & 工具) =====
  {
    id: 'g1q1',
    group: 1,
    text: '第一次拿到kig皮，你突然发现你的手背不过去拉不到拉链，此时你…',
    options: [
      { label: 'A', text: '像蛆一样在床上扭动挣扎', scores: { 0: 0, 2: 1 } },
      { label: 'B', text: '早已在拉链绑上绳子，轻松搞定', scores: { 0: 2, 1: 2 } },
      { label: 'C', text: '寻求室友/朋友帮助', scores: { 0: 1, 8: 1 } }
    ]
  },
  {
    id: 'g1q2',
    group: 1,
    text: '在外拍过程中，你突然感到一阵强烈的尿意…',
    options: [
      { label: 'A', text: '提前8小时断水断食，我没有这种世俗的欲望', scores: { 2: 2, 0: 1 } },
      { label: 'B', text: '告知后勤找个残厕', scores: { 2: 1, 8: 1 } },
      { label: 'C', text: '难道这也是play的一环？', scores: { 5: 2, 6: 1 } }
    ]
  },
  {
    id: 'g1q3',
    group: 1,
    text: '如何看待娃圈大佬制作的便利工具（OpenDoll捏脸、KigMap娃圈地图、KigTTS变声器）？',
    options: [
      { label: 'A', text: '听说过，正在使用/愿意尝试', scores: { 1: 2, 8: 1 } },
      { label: 'B', text: '听说过，但懒得折腾', scores: { 1: 0 } },
      { label: 'C', text: '完全没听说过', scores: { 1: 0, 8: 0 } }
    ]
  },
  {
    id: 'g1q4',
    group: 1,
    text: '如何看待市面上的量产头/均码皮？',
    options: [
      { label: 'A', text: '挺好的，大大降低了萌新入圈门槛', scores: { 9: 0, 8: 1 } },
      { label: 'B', text: '无所谓，但感觉终究没定制头还原度高', scores: { 9: 1, 11: 1 } },
      { label: 'C', text: '不太能接受复制人撞脸', scores: { 9: 2, 11: 2 } }
    ]
  },

  // ===== 第二组 (表现 & 风格) =====
  {
    id: 'g2q1',
    group: 2,
    text: '第一次戴上头壳面对镜头，你的反应是…',
    options: [
      { label: 'A', text: '人机，不知道摆什么姿势', scores: { 3: 0, 4: 0 } },
      { label: 'B', text: '努力回想动漫角色的pose，但做出来很奇怪', scores: { 3: 1, 4: 1 } },
      { label: 'C', text: '瞬间入戏，无情摆pose机器', scores: { 3: 2, 4: 2 } }
    ]
  },
  {
    id: 'g2q2',
    group: 2,
    text: '你的动作库有多丰富？',
    options: [
      { label: 'A', text: '剪刀手、比心，没了', scores: { 3: 0 } },
      { label: 'B', text: '能完美还原动漫角色的招牌动作', scores: { 3: 1, 4: 1 } },
      { label: 'C', text: '各种高难度柔韧姿势、跪姿、扭腰信手拈来', scores: { 3: 2, 5: 1 } }
    ]
  },
  {
    id: 'g2q3',
    group: 2,
    text: '外拍结束后回家，发现返图不是炸毛就是眼片反光…',
    options: [
      { label: 'A', text: '后期尽力补救', scores: { 10: 2, 2: 1 } },
      { label: 'B', text: '心态爆炸，但也只能无奈删照片', scores: { 2: 0 } },
      { label: 'C', text: 'Banana神力！', scores: { 6: 2, 2: 2 } }
    ]
  },
  {
    id: 'g2q4',
    group: 2,
    text: '对于Kig的内容和照片风格，你更偏好？',
    options: [
      { label: 'A', text: '纯清水，变娃只为了拍好看的照片', scores: { 5: 0, 4: 1 } },
      { label: 'B', text: '愿意尝试各种play，高频参与线下娃聚', scores: { 5: 2, 8: 2 } },
      { label: 'C', text: '纯清水，但是流的清水', scores: { 5: 1, 6: 1 } }
    ]
  },
  {
    id: 'g2q5',
    group: 2,
    text: '拍摄时，觉得自己戴上面具后…',
    options: [
      { label: 'A', text: '依然社恐，木头人', scores: { 4: 0, 6: 0 } },
      { label: 'B', text: '极其享受角色代入感', scores: { 4: 2, 3: 1 } },
      { label: 'C', text: '直接上锁，永久变娃', scores: { 4: 2, 5: 2, 3: 2 } }
    ]
  },

  // ===== 第三组 (社交) =====
  {
    id: 'g3q1',
    group: 3,
    text: '公园外拍，路人小孩戳你大腿问："妈妈，这是真人还是机器人？"，你：',
    options: [
      { label: 'A', text: '打招呼简单互动', scores: { 6: 1, 8: 1 } },
      { label: 'B', text: '假装自己真的是机器人', scores: { 6: 2, 4: 1 } },
      { label: 'C', text: '你才人机 😤', scores: { 7: 1, 6: 2 } }
    ]
  },
  {
    id: 'g3q2',
    group: 3,
    text: '变娃过程中遇到圈外人试图搭话，因为你无法说话，你会？',
    options: [
      { label: 'A', text: '打手势比划，你画我猜', scores: { 6: 1, 8: 1 } },
      { label: 'B', text: '用手机备忘录打字/使用变声工具交流', scores: { 1: 1, 8: 2 } },
      { label: 'C', text: '躲到后勤身后不知所措', scores: { 6: 0, 8: 0 } }
    ]
  },
  {
    id: 'g3q3',
    group: 3,
    text: '对待外拍时的路人强势围观…',
    options: [
      { label: 'A', text: '哈哈，根本不外拍', scores: { 6: 0, 8: 0 } },
      { label: 'B', text: '习惯了，正常打招呼', scores: { 6: 1, 8: 1 } },
      { label: 'C', text: '社牛，人越多越能整活', scores: { 6: 2, 8: 2, 4: 1 } }
    ]
  },
  {
    id: 'g3q4',
    group: 3,
    text: '网上遇到不认识的圈外人私信问奇怪的问题或发骚扰信息…',
    options: [
      { label: 'A', text: '觉得被冒犯，直接拉黑', scores: { 7: 0 } },
      { label: 'B', text: '问候对方父母/激情对线', scores: { 7: 1, 6: 1 } },
      { label: 'C', text: '截图挂人/装片哥反向骚扰整活', scores: { 7: 2, 6: 2 } }
    ]
  },
  {
    id: 'g3q5',
    group: 3,
    text: '漫展上遇到其他不认识的Kiger，你会？',
    options: [
      { label: 'A', text: '娃娃远观不可亵玩，社恐不敢上前打扰', scores: { 8: 0, 6: 0 } },
      { label: 'B', text: '等别人主动来找我贴贴', scores: { 8: 1, 6: 1 } },
      { label: 'C', text: '主动上前打招呼集邮', scores: { 8: 2, 6: 2 } }
    ]
  },

  // ===== 第四组 (经济 & 维护) =====
  {
    id: 'g4q1',
    group: 4,
    text: '你现在有几个头壳？',
    options: [
      { label: 'A', text: '就一个，刚入坑/单推人/省吃俭用买的', scores: { 11: 0 } },
      { label: 'B', text: '2-5个，换着玩', scores: { 11: 1 } },
      { label: 'C', text: '十头以上多头大佬/我就是搓头的', scores: { 11: 2, 10: 1 } }
    ]
  },
  {
    id: 'g4q2',
    group: 4,
    text: '遇到极其心仪但价格昂贵的头壳，你的倾向是？',
    options: [
      { label: 'A', text: '先交了定金再说', scores: { 11: 2, 9: 1 } },
      { label: 'B', text: '可是我没有钱', scores: { 11: 0 } },
      { label: 'C', text: '直接入替', scores: { 11: 2, 9: 2 } }
    ]
  },
  {
    id: 'g4q3',
    group: 4,
    text: '皮不小心勾丝破洞/头壳磕碰，你会怎么办？',
    options: [
      { label: 'A', text: '超强动手能力，针线手工自救', scores: { 10: 2 } },
      { label: 'B', text: '无事发生，等不得不修的时候再返厂', scores: { 10: 0 } },
      { label: 'C', text: '或许这也是一种战损？', scores: { 10: 0, 6: 1 } }
    ]
  },
  {
    id: 'g4q4',
    group: 4,
    text: '为了玩Kig，你投入最多的是？',
    options: [
      { label: 'A', text: '金钱（买头、买皮、约正片）', scores: { 11: 2 } },
      { label: 'B', text: '时间（化妆、穿戴、修图修到肝爆）', scores: { 10: 1, 4: 1 } },
      { label: 'C', text: '精力（夏天外拍抗热抗缺氧，变娃糕手）', scores: { 2: 2, 3: 1 } }
    ]
  },
  {
    id: 'g4q5',
    group: 4,
    text: '平时维护头壳的习惯是？',
    options: [
      { label: 'A', text: '每次拍完仔细理毛、非常小心', scores: { 10: 2 } },
      { label: 'B', text: '随便擦擦，塞回箱子里吃灰', scores: { 10: 0 } },
      { label: 'C', text: '供在展示柜里每天欣赏', scores: { 10: 1, 9: 1 } }
    ]
  },

  // ===== 第五组 (认同 & 心态) =====
  {
    id: 'g5q1',
    group: 5,
    text: '因为太热或闷得受不了，在漫展等公共场合"摘头"…',
    options: [
      { label: 'A', text: '绝对的社死禁忌！宁愿中暑也绝不当众摘头！', scores: { 6: 0, 2: 2 } },
      { label: 'B', text: '找个绝对没人的残卫或帐篷，偷偷掀起一点点呼吸', scores: { 6: 1, 2: 1 } },
      { label: 'C', text: '实在受不了就摘了呗（你将被开除Kig籍）', scores: { 6: 2, 2: 0 } }
    ]
  },
  {
    id: 'g5q2',
    group: 5,
    text: '你的照片在b站/抖音被盗用，甚至被编造奇怪的故事…',
    options: [
      { label: 'A', text: '私信警告对方删除', scores: { 7: 0 } },
      { label: 'B', text: '挂人举报一条龙', scores: { 7: 1, 8: 1 } },
      { label: 'C', text: '敢盗你爹的图，你爷爷出生的时候你妈都不在呢', scores: { 7: 2, 6: 2 } }
    ]
  },
  {
    id: 'g5q3',
    group: 5,
    text: '突然某一天，看着镜子里戴着巨大面具的自己，你觉得…',
    options: [
      { label: 'A', text: '爷真可爱', scores: { 4: 2, 3: 1 } },
      { label: 'B', text: '怎么看怎么奇怪，可能垫少了？', scores: { 9: 1, 4: 0 } },
      { label: 'C', text: '也许这才是本体？', scores: { 4: 2, 5: 2, 3: 2 } }
    ]
  },
  {
    id: 'g5q4',
    group: 5,
    text: '如果有一天退圈了，头壳怎么处理？',
    options: [
      { label: 'A', text: '挂闲鱼回血', scores: { 11: 0 } },
      { label: 'B', text: '当传家宝供起来留给儿子孙子', scores: { 9: 1, 10: 1 } },
      { label: 'C', text: '带进棺材里/物理销毁', scores: { 9: 2, 5: 1 } }
    ]
  },
  {
    id: 'g5q5',
    group: 5,
    text: '店家忘给你开眼窗了',
    options: [
      { label: 'A', text: '这是B？', scores: { 1: 0, 2: 1 } },
      { label: 'B', text: '摸起来有点像C', scores: { 1: 0, 6: 1 } },
      { label: 'C', text: '啥也看不见啊', scores: { 2: 0 } }
    ]
  }
];

// 每次测试随机抽取的题目数量
const QUESTIONS_PER_TEST = 15;

/**
 * 从每组中均匀抽题，保证覆盖度
 * 5 组各 3 题 = 15 题
 */
function pickQuestions() {
  const grouped = {};
  FULL_QUESTIONS.forEach(q => {
    if (!grouped[q.group]) grouped[q.group] = [];
    grouped[q.group].push(q);
  });

  const picked = [];
  const groups = Object.keys(grouped).sort();

  // 每组抽 3 题
  groups.forEach(g => {
    const pool = [...grouped[g]];
    shuffle(pool);
    picked.push(...pool.slice(0, 3));
  });

  shuffle(picked);
  return picked;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
