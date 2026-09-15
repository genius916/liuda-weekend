/* ============================================
   溜达 · 数据层
   演示数据 + localStorage 持久化
   ============================================ */

const STORE_KEY = 'liuda_store_v1';

/* ---------- 活动分类 ---------- */
const CATEGORIES = {
  exhibition: { name: '展览', color: '#8b5cf6', bg: '#f3efff', icon: 'exhibition' },
  market:     { name: '市集', color: '#f59e0b', bg: '#fff5e6', icon: 'market' },
  show:       { name: '演出', color: '#ec4899', bg: '#ffeef6', icon: 'show' },
  hike:       { name: '徒步', color: '#10b981', bg: '#e8f9f1', icon: 'hike' },
  food:       { name: '美食', color: '#ef4444', bg: '#ffecec', icon: 'food' },
  other:      { name: '其他', color: '#64748b', bg: '#f0f2f5', icon: 'other' },
};

/* ---------- 天气类型 ---------- */
const WEATHERS = {
  sunny:  { name: '晴',    emoji: '☀️', desc: '适合户外', icon: 'sunny' },
  cloudy: { name: '多云',  emoji: '⛅', desc: '阴晴不定', icon: 'cloudy' },
  rain:   { name: '小雨',  emoji: '🌧️', desc: '带伞出门', icon: 'rain' },
};

/* WMO 天气码 → 天气类型（Open-Meteo 免费接口，无需 key） */
const WMO_TO_WEATHER = {
  0: 'sunny', 1: 'sunny', 2: 'cloudy', 3: 'cloudy',          // 晴 / 多云
  45: 'cloudy', 48: 'cloudy',                                 // 雾
  51: 'rain', 53: 'rain', 55: 'rain',                         // 毛毛雨
  61: 'rain', 63: 'rain', 65: 'rain',                         // 雨
  66: 'rain', 67: 'rain', 71: 'rain', 73: 'rain', 75: 'rain', // 冻雨/雪（归为雨天）
  77: 'rain', 80: 'rain', 81: 'rain', 82: 'rain',             // 阵雨
  85: 'rain', 86: 'rain', 95: 'rain', 96: 'rain', 99: 'rain', // 雪/雷暴
};

/* 城市坐标（杭州） */
const CITY = { name: '杭州', lat: 30.2741, lng: 120.1551 };

/* ---------- 交通方式 ---------- */
const TRANSPORTS = [
  { key: 'any',    name: '都行',   desc: '不限交通' },
  { key: 'metro',  name: '地铁/公交', desc: '市内可达' },
  { key: 'self',   name: '自驾',   desc: '灵活自由' },
  { key: 'train',  name: '高铁/火车', desc: '跨城 2-4h' },
  { key: 'plane',  name: '飞机',   desc: '远途 2h 航程' },
];

/* ---------- 距离范围（距当前城市） ---------- */
const DISTANCES = [
  { key: 'within_city', name: '市区内', range: '10km 内',   km: 10 },
  { key: 'near',        name: '近郊',   range: '50km 内',   km: 50 },
  { key: 'mid',         name: '周边城市', range: '200km 内', km: 200 },
  { key: 'far',         name: '远途',   range: '500km+',    km: 500 },
];

/* ---------- 预算档位（去掉几十元档，100 元起，上不封顶） ---------- */
const BUDGETS = [
  { key: 'b100',  value: 100,  label: '≤ ¥100',  desc: '穷游党' },
  { key: 'b300',  value: 300,  label: '≤ ¥300',  desc: '轻奢一日' },
  { key: 'b500',  value: 500,  label: '≤ ¥500',  desc: '品质周末' },
  { key: 'b1000', value: 1000, label: '≤ ¥1000', desc: '跨城玩一趟' },
  { key: 'b3000', value: 3000, label: '≤ ¥3000', desc: '说走就走' },
  { key: 'unlimit', value: 999999, label: '不限', desc: '预算自由' },
];

/* ---------- 同行人数 ---------- */
const COMPANIONS = {
  solo: '一个人', small: '2-3 人', group: '4 人以上',
};

/* ---------- StepFun AI 推荐接口 ---------- */
const STEPFUN_CONFIG = {
  endpoint: 'https://api.stepfun.com/v1/chat/completions',
  apiKey: '3y4thYb47q3bm2ztLTUk1eZvp1IRRx16c8xsSWY8CgQXp0AllDHolFsUwxRlhYj1R',
  model: 'step-3.7-flash',
};

/**
 * 调用 StepFun AI 生成推荐目的地
 * @param {object} prefs 用户偏好 {interests, budget, transport, distance, companion, note, city, weather}
 * @returns {Promise<Array|null>} 推荐目的地数组，失败返回 null
 */
async function fetchAIRecommendations(prefs) {
  try {
    const system = `你是一位专业的周末旅行规划师，擅长根据用户的偏好推荐真实、可执行的目的地。
你必须严格遵守以下输出格式：只输出一个 JSON 数组，不要输出任何解释文字、markdown 代码块或前后缀。
数组里每个元素是一个对象，包含以下字段（全部必填）：
{
  "title": "目的地/活动名称（具体、真实，如「莫干山轻徒步」「苏州园林一日游」）",
  "category": "分类，只能是 exhibition/market/show/hike/food/other 之一",
  "location": "具体地点或区域",
  "distance": 距离当前城市的公里数（数字）,
  "cost": 人均花费（数字，元）,
  "transport": "建议交通方式，如 高铁1.5h / 自驾2h / 地铁直达",
  "reason": "推荐理由（一句话，说明为什么适合该用户）",
  "tags": ["2-3个标签"]
}`;
    const transportName = prefs.transport && prefs.transport !== 'any'
      ? (TRANSPORTS.find(t => t.key === prefs.transport)?.name || prefs.transport) : '不限';
    const distanceName = prefs.distance
      ? (DISTANCES.find(d => d.key === prefs.distance)?.name || prefs.distance) : '不限';
    const companionName = prefs.companion ? (COMPANIONS[prefs.companion] || prefs.companion) : '不限';
    const user = `当前城市：${prefs.city || CITY.name}。
用户偏好：
- 兴趣类型：${(prefs.interests || []).map(k => (CATEGORIES[k] ? CATEGORIES[k].name : k)).join('、') || '不限'}
- 预算：${prefs.budget >= 999999 ? '不限' : prefs.budget + ' 元以内'}
- 交通方式：${transportName}
- 距离范围：${distanceName}
- 同行人数：${companionName}
- 额外需求：${prefs.note || '无'}
- 今日天气：${prefs.weather ? (WEATHERS[prefs.weather]?.name || prefs.weather) : '未知'}

请推荐 5 个最适合该用户的真实周末目的地，覆盖不同风格，每个目的地都要符合上述偏好约束。`;

    const res = await fetch(STEPFUN_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + STEPFUN_CONFIG.apiKey,
      },
      body: JSON.stringify({
        model: STEPFUN_CONFIG.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content || '';
    // 清理可能的 markdown 代码块包裹
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    // 提取 JSON 数组
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start === -1 || end === -1) return null;
    const arr = JSON.parse(content.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    // 规范化并补全字段
    // 按分类给一张默认真实封面图（避免 AI 结果全是纯色）
    const CAT_IMG = {
      exhibition: '1561214115-f2f134cc4912',
      market: '1533900298318-6b8da08a523e',
      show: '1470229722913-7c0e2dbbafd3',
      hike: '1506905925346-21bda4d32df4',
      food: '1501339847302-ac426a4a7cbb',
      other: '1449824913935-59a10b8d2000',
    };
    return arr.filter(x => x && x.title).map((x, i) => {
      const cat = CATEGORIES[x.category] ? x.category : 'other';
      return {
        id: 'ai_' + Date.now().toString(36) + '_' + i,
        title: String(x.title).slice(0, 40),
        category: cat,
        location: String(x.location || '待定'),
        distance: Number(x.distance) || 0,
        cost: Number(x.cost) || 0,
        transport: String(x.transport || ''),
        weatherFit: ['sunny', 'cloudy', 'rain'],
        crowd: '中',
        tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 3) : [],
        reason: String(x.reason || 'AI 根据你的偏好为你挑选'),
        img: uimg(CAT_IMG[cat]),
        rating: 4.5,
        likes: 0,
        date: '本周末',
        matchReasons: ['AI 个性化推荐', '符合你的偏好'],
        isAI: true,
      };
    });
  } catch (e) {
    console.warn('StepFun AI 推荐失败，走本地降级', e);
    return null;
  }
}

/* 获取真实天气（Open-Meteo，失败返回 null 走降级） */
async function fetchRealWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weather_code ?? data.daily?.weather_code?.[0];
    const temp = data.current?.temperature_2m ?? data.daily?.temperature_2m_max?.[0];
    if (code === undefined) return null;
    return {
      type: WMO_TO_WEATHER[code] || 'cloudy',
      temp: Math.round(temp),
      code,
    };
  } catch (e) {
    return null;
  }
}

/* ---------- 演示活动 ---------- */
/* Unsplash 免费图源（国内可达，加 onerror 降级渐变） */
function uimg(id) {
  return `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
}

const DEMO_ACTIVITIES = [
  {
    id: 'a1', title: '「山海之间」当代艺术展', category: 'exhibition',
    location: '南山美术馆', distance: 3.2, cost: 40,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '中',
    tags: ['艺术', '室内', '拍照好看'],
    reason: '评分 4.8，雨天也能逛，学生票半价',
    img: uimg('1561214115-f2f134cc4912'), rating: 4.8, likes: 236, date: '本周末',
  },
  {
    id: 'a2', title: '周末手作市集 · 文创夜市', category: 'market',
    location: '老城创意园', distance: 1.8, cost: 20,
    weatherFit: ['sunny', 'cloudy'], crowd: '高',
    tags: ['市集', '手作', '夜间'],
    reason: '离校 1.8km，步行可达，20 元能逛一下午',
    img: uimg('1533900298318-6b8da08a523e'), rating: 4.6, likes: 518, date: '周六 18:00',
  },
  {
    id: 'a3', title: '独立乐队 livehouse 拼盘', category: 'show',
    location: 'NEO Live', distance: 4.5, cost: 120,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '高',
    tags: ['音乐', '演出', '夜晚'],
    reason: '3 支本地乐队，气氛超好，预算偏高但值得',
    img: uimg('1470229722913-7c0e2dbbafd3'), rating: 4.9, likes: 402, date: '周六 20:30',
  },
  {
    id: 'a4', title: '北山古道轻徒步 · 日出线', category: 'hike',
    location: '北山国家森林公园', distance: 12, cost: 0,
    weatherFit: ['sunny'], crowd: '低',
    tags: ['徒步', '户外', '免费'],
    reason: '免费，晴天视野绝佳，适合早起党',
    img: uimg('1506905925346-21bda4d32df4'), rating: 4.7, likes: 189, date: '周日 05:30',
  },
  {
    id: 'a5', title: '桂花季 · 老巷咖啡馆巡礼', category: 'food',
    location: '城南老街', distance: 2.6, cost: 60,
    weatherFit: ['cloudy', 'rain'], crowd: '中',
    tags: ['美食', '咖啡', '探店'],
    reason: '桂花当季，雨天躲进咖啡馆正合适',
    img: uimg('1501339847302-ac426a4a7cbb'), rating: 4.5, likes: 321, date: '本周末',
  },
  {
    id: 'a6', title: '城市骑行 · 环湖落日线', category: 'hike',
    location: '西湖环湖绿道', distance: 6, cost: 15,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['骑行', '户外', '落日'],
    reason: '共享单车 15 元搞定，傍晚景色封神',
    img: uimg('1485965120184-e220f721d03e'), rating: 4.8, likes: 277, date: '周日 16:00',
  },
  {
    id: 'a7', title: '沉浸式剧本杀《迷雾剧院》', category: 'show',
    location: '谜局剧本社', distance: 3.8, cost: 98,
    weatherFit: ['rain'], crowd: '中',
    tags: ['剧本杀', '室内', '组队'],
    reason: '雨天首选，人均 98，需要 6 人成团',
    img: uimg('1528605248644-14dd04022da1'), rating: 4.4, likes: 156, date: '周六 14:00',
  },
  {
    id: 'a8', title: '独立纪录片展映周', category: 'exhibition',
    location: '光影艺术中心', distance: 5.1, cost: 30,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '低',
    tags: ['电影', '室内', '文艺'],
    reason: '小众片单，30 元看一整天，人少安静',
    img: uimg('1489599849927-2ee91cede3ba'), rating: 4.6, likes: 98, date: '本周末',
  },
];

/* ---------- 演示组队 ---------- */
const DEMO_TEAMS = [
  {
    id: 't1', title: '周日北山徒步看日出', activityId: 'a4',
    departTime: '周日 05:00', meetPoint: '学校东门公交站',
    members: ['林一', '阿哲', '小鹿'], maxMembers: 6, tag: 'hike',
    note: '凌晨出发，记得带水和外套',
    poster: '林一',
  },
  {
    id: 't2', title: '周六手作市集一起逛', activityId: 'a2',
    departTime: '周六 15:30', meetPoint: '老城创意园正门',
    members: ['阿哲', '小鹿'], maxMembers: 4, tag: 'market',
    note: '逛完顺路吃夜市',
    poster: '阿哲',
  },
  {
    id: 't3', title: '剧本杀《迷雾剧院》缺 3 人', activityId: 'a7',
    departTime: '周六 13:30', meetPoint: '谜局剧本社',
    members: ['小鹿', '林一', '阿哲'], maxMembers: 6, tag: 'show',
    note: '新手友好，DM 会带',
    poster: '小鹿',
  },
];

/* ---------- 演示打卡 ---------- */
const DEMO_CHECKINS = [
  { id: 'c1', activityId: 'a1', title: '山海之间艺术展', date: '2026-09-06', note: '雨天人少，看展体验拉满，学生票半价真香。', rating: 5, img: '', likes: 45, lat: 30.2741, lng: 120.1551 },
  { id: 'c2', activityId: 'a4', title: '北山古道徒步', date: '2026-08-30', note: '日出绝了！就是起床太痛苦，下山膝盖酸。', rating: 5, img: '', likes: 61, lat: 30.3150, lng: 120.0980 },
  { id: 'c3', activityId: 'a6', title: '环湖骑行', date: '2026-08-23', note: '落日线名不虚传，骑行 6km 完全不累。', rating: 4, img: '', likes: 33, lat: 30.2590, lng: 120.1300 },
];

/* ---------- 演示攻略 ---------- */
const DEMO_GUIDES = [
  {
    id: 'g1', title: '杭州周末 48h 不重样攻略', author: '林一', avatarColor: '#8b5cf6',
    tags: ['citywalk', '美食', '周末'], cover: uimg('1449824913935-59a10b8d2000'), likes: 1289, favs: 320, read: '12.3w',
    excerpt: '从清晨的桂花巷，到深夜的 livehouse，两天逛完杭州最值得去的地方。',
    content: '...',
  },
  {
    id: 'g2', title: '穷游党必看：0 元玩转城市展览', author: '阿哲', avatarColor: '#f59e0b',
    tags: ['展览', '免费', '省钱'], cover: uimg('1577720580479-7d839d829c73'), likes: 896, favs: 210, read: '8.9w',
    excerpt: '美术馆、博物馆、独立展厅……这些免费展览质量一点不输收费的。',
    content: '...',
  },
  {
    id: 'g3', title: '雨天不宅指南：室内活动清单', author: '小鹿', avatarColor: '#10b981',
    tags: ['雨天', '室内', '清单'], cover: uimg('1531058020387-3be344556be6'), likes: 743, favs: 158, read: '6.7w',
    excerpt: '下雨不是不出门的理由，剧本杀、咖啡馆、展馆……雨天有雨天的玩法。',
    content: '...',
  },
  {
    id: 'g4', title: '北山徒步新手装备清单', author: '林一', avatarColor: '#8b5cf6',
    tags: ['徒步', '装备', '新手'], cover: uimg('1551632811-561732d1e306'), likes: 512, favs: 96, read: '4.2w',
    excerpt: '第一次徒步别乱买，这份清单帮你把钱花在刀刃上。',
    content: '...',
  },
];

const GUIDE_TAGS = ['全部', 'citywalk', '美食', '展览', '免费', '徒步', '雨天', '装备', '省钱'];

/* ---------- 当前用户 ---------- */
const CURRENT_USER = { name: '我', avatarColor: '#059669', city: '杭州' };

/* ---------- 默认状态 ---------- */
const DEFAULT_STATE = {
  user: {
    name: '溜达青年',
    avatarColor: '#059669',
    interests: ['exhibition', 'market', 'hike'],
    budget: 100,
    signCount: 7,
    checkinCount: 3,
    favCount: 5,
  },
  activities: DEMO_ACTIVITIES,
  teams: DEMO_TEAMS,
  checkins: DEMO_CHECKINS,
  guides: DEMO_GUIDES,
  myTeams: ['t2'],
  myFavGuides: ['g1', 'g3'],
  myFavActivities: ['a1'],
  weather: 'sunny',       // sunny / cloudy / rain
  filterPrefs: { cat: 'all', budget: 100, weather: 'sunny' },
  onboarded: false,       // 是否完成偏好引导
  tripPrefs: {            // 出行偏好（引导流收集）
    transport: 'any',     // 交通方式 key
    distance: 'near',     // 距离范围 key
    note: '',             // 额外需求备注
  },
  aiRecommended: [],      // AI 生成的推荐结果（空则用本地推荐）
};

/* ---------- 存储层 ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...saved };
    }
  } catch (e) { console.warn('读取本地数据失败', e); }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('保存本地数据失败', e); }
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- 工具 ---------- */
function getActivity(id) {
  return state.activities.find(a => a.id === id)
    || (state.aiRecommended || []).find(a => a.id === id);
}
function getTeam(id) { return state.teams.find(t => t.id === id); }
function getCat(c) { return CATEGORIES[c] || CATEGORIES.other; }
function getWeather(w) { return WEATHERS[w] || WEATHERS.sunny; }

/* 智能推荐算法：按兴趣 + 天气 + 预算打分，并输出推荐依据 */
function recommend() {
  const { cat, budget, weather } = state.filterPrefs;
  const interests = state.user.interests;
  return state.activities
    .map(a => {
      let score = 0;
      const reasons = [];   // 推荐依据（结构化）
      // 兴趣匹配（分类命中 +3，标签命中每个 +1）
      if (interests.includes(a.category)) {
        score += 3;
        reasons.push('符合你的兴趣');
      }
      a.tags.forEach(t => {
        if (interests.some(i => getCat(i).name === t)) score += 1;
      });
      // 天气适配（不适配直接扣到负分）
      if (a.weatherFit.includes(weather)) {
        score += 2;
        reasons.push('天气适合');
      }
      else score -= 5;
      // 预算（预算内 +2，超出越多扣越多）
      if (a.cost <= budget) {
        score += 2;
        reasons.push('预算内');
      }
      else score -= Math.ceil((a.cost - budget) / 50);
      // 热度加成
      score += a.rating / 10;
      if (a.rating >= 4.7) reasons.push('高分好评');
      return { ...a, score, matchReasons: reasons };
    })
    .filter(a => {
      if (cat !== 'all' && a.category !== cat) return false;
      return true;
    })
    .sort((x, y) => y.score - x.score);
}
