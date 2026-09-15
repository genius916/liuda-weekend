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

/* ---------- 演示活动 ---------- */
const DEMO_ACTIVITIES = [
  {
    id: 'a1', title: '「山海之间」当代艺术展', category: 'exhibition',
    location: '南山美术馆', distance: 3.2, cost: 40,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '中',
    tags: ['艺术', '室内', '拍照好看'],
    reason: '评分 4.8，雨天也能逛，学生票半价',
    img: '', rating: 4.8, likes: 236, date: '本周末',
  },
  {
    id: 'a2', title: '周末手作市集 · 文创夜市', category: 'market',
    location: '老城创意园', distance: 1.8, cost: 20,
    weatherFit: ['sunny', 'cloudy'], crowd: '高',
    tags: ['市集', '手作', '夜间'],
    reason: '离校 1.8km，步行可达，20 元能逛一下午',
    img: '', rating: 4.6, likes: 518, date: '周六 18:00',
  },
  {
    id: 'a3', title: '独立乐队 livehouse 拼盘', category: 'show',
    location: 'NEO Live', distance: 4.5, cost: 120,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '高',
    tags: ['音乐', '演出', '夜晚'],
    reason: '3 支本地乐队，气氛超好，预算偏高但值得',
    img: '', rating: 4.9, likes: 402, date: '周六 20:30',
  },
  {
    id: 'a4', title: '北山古道轻徒步 · 日出线', category: 'hike',
    location: '北山国家森林公园', distance: 12, cost: 0,
    weatherFit: ['sunny'], crowd: '低',
    tags: ['徒步', '户外', '免费'],
    reason: '免费，晴天视野绝佳，适合早起党',
    img: '', rating: 4.7, likes: 189, date: '周日 05:30',
  },
  {
    id: 'a5', title: '桂花季 · 老巷咖啡馆巡礼', category: 'food',
    location: '城南老街', distance: 2.6, cost: 60,
    weatherFit: ['cloudy', 'rain'], crowd: '中',
    tags: ['美食', '咖啡', '探店'],
    reason: '桂花当季，雨天躲进咖啡馆正合适',
    img: '', rating: 4.5, likes: 321, date: '本周末',
  },
  {
    id: 'a6', title: '城市骑行 · 环湖落日线', category: 'hike',
    location: '西湖环湖绿道', distance: 6, cost: 15,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['骑行', '户外', '落日'],
    reason: '共享单车 15 元搞定，傍晚景色封神',
    img: '', rating: 4.8, likes: 277, date: '周日 16:00',
  },
  {
    id: 'a7', title: '沉浸式剧本杀《迷雾剧院》', category: 'show',
    location: '谜局剧本社', distance: 3.8, cost: 98,
    weatherFit: ['rain'], crowd: '中',
    tags: ['剧本杀', '室内', '组队'],
    reason: '雨天首选，人均 98，需要 6 人成团',
    img: '', rating: 4.4, likes: 156, date: '周六 14:00',
  },
  {
    id: 'a8', title: '独立纪录片展映周', category: 'exhibition',
    location: '光影艺术中心', distance: 5.1, cost: 30,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '低',
    tags: ['电影', '室内', '文艺'],
    reason: '小众片单，30 元看一整天，人少安静',
    img: '', rating: 4.6, likes: 98, date: '本周末',
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
  { id: 'c1', activityId: 'a1', title: '山海之间艺术展', date: '2026-09-06', note: '雨天人少，看展体验拉满，学生票半价真香。', rating: 5, img: '', likes: 45 },
  { id: 'c2', activityId: 'a4', title: '北山古道徒步', date: '2026-08-30', note: '日出绝了！就是起床太痛苦，下山膝盖酸。', rating: 5, img: '', likes: 61 },
  { id: 'c3', activityId: 'a6', title: '环湖骑行', date: '2026-08-23', note: '落日线名不虚传，骑行 6km 完全不累。', rating: 4, img: '', likes: 33 },
];

/* ---------- 演示攻略 ---------- */
const DEMO_GUIDES = [
  {
    id: 'g1', title: '杭州周末 48h 不重样攻略', author: '林一', avatarColor: '#8b5cf6',
    tags: ['citywalk', '美食', '周末'], cover: '', likes: 1289, favs: 320, read: '12.3w',
    excerpt: '从清晨的桂花巷，到深夜的 livehouse，两天逛完杭州最值得去的地方。',
    content: '...',
  },
  {
    id: 'g2', title: '穷游党必看：0 元玩转城市展览', author: '阿哲', avatarColor: '#f59e0b',
    tags: ['展览', '免费', '省钱'], cover: '', likes: 896, favs: 210, read: '8.9w',
    excerpt: '美术馆、博物馆、独立展厅……这些免费展览质量一点不输收费的。',
    content: '...',
  },
  {
    id: 'g3', title: '雨天不宅指南：室内活动清单', author: '小鹿', avatarColor: '#10b981',
    tags: ['雨天', '室内', '清单'], cover: '', likes: 743, favs: 158, read: '6.7w',
    excerpt: '下雨不是不出门的理由，剧本杀、咖啡馆、展馆……雨天有雨天的玩法。',
    content: '...',
  },
  {
    id: 'g4', title: '北山徒步新手装备清单', author: '林一', avatarColor: '#8b5cf6',
    tags: ['徒步', '装备', '新手'], cover: '', likes: 512, favs: 96, read: '4.2w',
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
function getActivity(id) { return state.activities.find(a => a.id === id); }
function getTeam(id) { return state.teams.find(t => t.id === id); }
function getCat(c) { return CATEGORIES[c] || CATEGORIES.other; }
function getWeather(w) { return WEATHERS[w] || WEATHERS.sunny; }

/* 智能推荐算法：按兴趣 + 天气 + 预算打分 */
function recommend() {
  const { cat, budget, weather } = state.filterPrefs;
  const interests = state.user.interests;
  return state.activities
    .map(a => {
      let score = 0;
      // 兴趣匹配（分类命中 +3，标签命中每个 +1）
      if (interests.includes(a.category)) score += 3;
      a.tags.forEach(t => {
        if (interests.some(i => getCat(i).name === t)) score += 1;
      });
      // 天气适配（不适配直接扣到负分）
      if (a.weatherFit.includes(weather)) score += 2;
      else score -= 5;
      // 预算（预算内 +2，超出越多扣越多）
      if (a.cost <= budget) score += 2;
      else score -= Math.ceil((a.cost - budget) / 50);
      // 热度加成
      score += a.rating / 10;
      return { ...a, score };
    })
    .filter(a => {
      if (cat !== 'all' && a.category !== cat) return false;
      return true;
    })
    .sort((x, y) => y.score - x.score);
}
