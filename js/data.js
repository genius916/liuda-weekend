/* ============================================
   溜达 · 数据层
   演示数据 + localStorage 持久化
   ============================================ */

const STORE_KEY = 'liuda_store_v1';

/* ---------- 活动分类 ---------- */
const CATEGORIES = {
  // 户外撒野（引导第 1 步优先呈现，户外选项尽量多）
  hike:       { name: '徒步', color: '#10b981', bg: '#e8f9f1', icon: 'hike',     group: 'outdoor' },
  mountain:   { name: '登山', color: '#0ea5e9', bg: '#e6f5fe', icon: 'mountain', group: 'outdoor' },
  rafting:    { name: '漂流', color: '#06b6d4', bg: '#e3f8fb', icon: 'rafting',  group: 'outdoor' },
  camp:       { name: '露营', color: '#65a30d', bg: '#f2fbe2', icon: 'camp',     group: 'outdoor' },
  bike:       { name: '骑行', color: '#14b8a6', bg: '#e4f8f6', icon: 'bike',     group: 'outdoor' },
  pick:       { name: '采摘', color: '#f97316', bg: '#fff1e5', icon: 'pick',     group: 'outdoor' },
  // 城市漫游
  exhibition: { name: '展览', color: '#8b5cf6', bg: '#f3efff', icon: 'exhibition', group: 'city' },
  market:     { name: '市集', color: '#f59e0b', bg: '#fff5e6', icon: 'market',     group: 'city' },
  show:       { name: '演出', color: '#ec4899', bg: '#ffeef6', icon: 'show',       group: 'city' },
  food:       { name: '美食', color: '#ef4444', bg: '#ffecec', icon: 'food',       group: 'city' },
  other:      { name: '其他', color: '#64748b', bg: '#f0f2f5', icon: 'other',      group: 'city' },
};

/* 引导第 1 步的分组（「其他」不参与选择，只作兜底分类） */
const CAT_GROUPS = [
  { key: 'outdoor', name: '户外撒野', emoji: '🏔️' },
  { key: 'city',    name: '城市漫游', emoji: '🎨' },
];
const PICKABLE_CATS = Object.keys(CATEGORIES).filter(k => k !== 'other');

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

/* 城市坐标（默认杭州，运行时按 IP 定位自动更新） */
const DEFAULT_CITY = { name: '杭州', lat: 30.2741, lng: 120.1551 };
let CITY = { ...DEFAULT_CITY };

/**
 * IP 定位获取用户所在城市 + 经纬度
 * 链路：ipinfo.io 取经纬度（有 CORS）
 *   → BigDataCloud 反向地理编码取中文城市/省份（有 CORS，localityLanguage=zh）
 *   → 反查失败退回英文城市名映射表 EN2CN_CITY
 *   → 全失败返回 null，由调用方兜底默认城市
 *
 * ⚠️ 曾用 api.vore.top 直接取中文城市名，但它响应里没有 Access-Control-Allow-Origin
 *    （实测多次 GET 均无），浏览器跨域必被拦；且行为不稳定——偶尔能通、偶尔 Failed to fetch，
 *    导致城市名随机变化。已弃用，切勿再引入无 CORS 头的定位接口。
 */
const EN2CN_CITY = {
  Beijing: '北京', Shanghai: '上海', Guangzhou: '广州', Shenzhen: '深圳',
  Hangzhou: '杭州', Nanjing: '南京', Suzhou: '苏州', Chengdu: '成都',
  Chongqing: '重庆', Wuhan: '武汉', Xian: "西安", Tianjin: '天津',
  Changsha: '长沙', Qingdao: '青岛', Xiamen: '厦门', Ningbo: '宁波',
  Zhengzhou: '郑州', Jinan: '济南', Hefei: '合肥', Fuzhou: '福州',
  Kunming: '昆明', Dalian: '大连', Shenyang: '沈阳', Harbin: '哈尔滨',
  Wenzhou: '温州', Jiaxing: '嘉兴', Shaoxing: '绍兴', Jinhua: '金华',
};

/* 去掉行政区划后缀，让"杭州市"→"杭州"、"浙江省"→"浙江" */
function shortName(s) {
  return String(s || '').replace(/[市省都道府]$/, '').trim();
}

/* 经纬度 → 中文城市/省份（BigDataCloud 免费、无需 key、带 CORS） */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    const name = shortName(d.city || d.locality);
    if (!name) return null;
    return { name, region: shortName(d.principalSubdivision), country: d.countryName || '' };
  } catch (e) {
    return null;
  }
}

async function fetchLocation() {
  try {
    const res = await fetch('https://ipinfo.io/json');
    if (!res.ok) return null;
    const d = await res.json();
    const [lat, lng] = String(d?.loc || '').split(',').map(Number);
    if (!isFinite(lat) || !isFinite(lng)) return null;

    const rev = await reverseGeocode(lat, lng);
    if (rev) return { name: rev.name, region: rev.region, country: rev.country, lat, lng };

    // 反查失败：退回英文城市名映射
    return { name: EN2CN_CITY[d.city] || d.city || DEFAULT_CITY.name, region: '', country: '', lat, lng };
  } catch (e) {
    return null;
  }
}

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

/* ---------- 城市文化内容库 ----------
   每条：city 城市 / region 省份 / text 名句或知识点 / from 出处 / spot 关联地点 / note 一句话解读
   city 已含地级市与知名县域，便于「每次刷新看到不同城市」                       */
const CULTURE_DATA = [
  // ===== 杭州 / 浙江 =====
  { city: '杭州', region: '浙江', text: '欲把西湖比西子，淡妆浓抹总相宜', from: '苏轼《饮湖上初晴后雨》', spot: '西湖', note: '把西湖比作西施，晴雨皆美' },
  { city: '杭州', region: '浙江', text: '接天莲叶无穷碧，映日荷花别样红', from: '杨万里《晓出净慈寺送林子方》', spot: '净慈寺', note: '写尽夏日西湖的荷塘盛景' },
  { city: '杭州', region: '浙江', text: '山外青山楼外楼，西湖歌舞几时休', from: '林升《题临安邸》', spot: '孤山', note: '南宋偏安临安的讽喻名句' },
  { city: '绍兴', region: '浙江', text: '红酥手，黄縢酒，满城春色宫墙柳', from: '陆游《钗头凤》', spot: '沈园', note: '陆游与唐婉题壁于沈园的爱情绝唱' },
  { city: '绍兴', region: '浙江', text: '山阴道上，应接不暇', from: '《世说新语·言语》', spot: '山阴道', note: '形容绍兴山水之美令人目不暇接' },

  // ===== 苏州 / 江苏 =====
  { city: '苏州', region: '江苏', text: '姑苏城外寒山寺，夜半钟声到客船', from: '张继《枫桥夜泊》', spot: '寒山寺', note: '羁旅愁思与江南钟声的经典意象' },
  { city: '苏州', region: '江苏', text: '绿浪东西南北水，红栏三百九十桥', from: '白居易《正月三日闲行》', spot: '平江路', note: '写尽苏州水城桥梁之盛' },
  { city: '扬州', region: '江苏', text: '故人西辞黄鹤楼，烟花三月下扬州', from: '李白《黄鹤楼送孟浩然之广陵》', spot: '瘦西湖', note: '把扬州三月写成最美的去处' },
  { city: '扬州', region: '江苏', text: '二十四桥明月夜，玉人何处教吹箫', from: '杜牧《寄扬州韩绰判官》', spot: '二十四桥', note: '月色箫声里的扬州旧梦' },
  { city: '南京', region: '江苏', text: '朱雀桥边野草花，乌衣巷口夕阳斜', from: '刘禹锡《乌衣巷》', spot: '乌衣巷', note: '写尽六朝兴废的沧桑' },

  // ===== 西安 / 陕西 =====
  { city: '西安', region: '陕西', text: '春风得意马蹄疾，一日看尽长安花', from: '孟郊《登科后》', spot: '长安城', note: '科举及第后的畅快，成为「得意」代名词' },
  { city: '西安', region: '陕西', text: '长安一片月，万户捣衣声', from: '李白《子夜吴歌·秋歌》', spot: '长安', note: '月色下的长安万户，苍茫而温柔' },
  { city: '西安', region: '陕西', text: '长安回望绣成堆，山顶千门次第开', from: '杜牧《过华清宫绝句》', spot: '华清宫', note: '骊山华清宫的盛唐气象' },

  // ===== 成都 / 四川 =====
  { city: '成都', region: '四川', text: '晓看红湿处，花重锦官城', from: '杜甫《春夜喜雨》', spot: '锦官城', note: '成都别称「锦官城」由此而来' },
  { city: '成都', region: '四川', text: '窗含西岭千秋雪，门泊东吴万里船', from: '杜甫《绝句》', spot: '西岭雪山', note: '一窗之内，千年雪与万里船' },

  // ===== 武汉 / 湖北 =====
  { city: '武汉', region: '湖北', text: '昔人已乘黄鹤去，此地空余黄鹤楼', from: '崔颢《黄鹤楼》', spot: '黄鹤楼', note: '唐人七律第一，李白见之搁笔' },
  { city: '武汉', region: '湖北', text: '一桥飞架南北，天堑变通途', from: '毛泽东《水调歌头·游泳》', spot: '武汉长江大桥', note: '新中国建桥史上的里程碑' },

  // ===== 长沙 / 湖南 =====
  { city: '长沙', region: '湖南', text: '独立寒秋，湘江北去，橘子洲头', from: '毛泽东《沁园春·长沙》', spot: '橘子洲', note: '橘子洲头成为长沙的精神地标' },
  { city: '长沙', region: '湖南', text: '惟楚有材，于斯为盛', from: '岳麓书院门联', spot: '岳麓书院', note: '千年学府的人才宣言' },

  // ===== 北京 / 天津 =====
  { city: '北京', region: '北京', text: '前不见古人，后不见来者', from: '陈子昂《登幽州台歌》', spot: '幽州台', note: '幽州台旧址在北京，写尽天地孤独' },
  { city: '北京', region: '北京', text: '卢沟晓月照燕京', from: '燕京八景之一', spot: '卢沟桥', note: '金章宗钦定的燕京八景之首' },

  // ===== 重庆 =====
  { city: '重庆', region: '重庆', text: '朝辞白帝彩云间，千里江陵一日还', from: '李白《早发白帝城》', spot: '白帝城·奉节', note: '三峡行舟之快的千古绝唱' },
  { city: '重庆', region: '重庆', text: '君问归期未有期，巴山夜雨涨秋池', from: '李商隐《夜雨寄北》', spot: '缙云山', note: '「巴山夜雨」成为川渝秋夜的文化符号' },

  // ===== 洛阳 / 河南 =====
  { city: '洛阳', region: '河南', text: '唯有牡丹真国色，花开时节动京城', from: '刘禹锡《赏牡丹》', spot: '洛阳牡丹园', note: '洛阳牡丹甲天下的由来' },
  { city: '洛阳', region: '河南', text: '洛阳亲友如相问，一片冰心在玉壶', from: '王昌龄《芙蓉楼送辛渐》', spot: '洛阳', note: '以玉壶冰心自证的清廉之志' },

  // ===== 敦煌 / 甘肃 =====
  { city: '敦煌', region: '甘肃', text: '劝君更尽一杯酒，西出阳关无故人', from: '王维《送元二使安西》', spot: '阳关', note: '阳关遗址在敦煌，丝绸之路的西出之门' },
  { city: '敦煌', region: '甘肃', text: '羌笛何须怨杨柳，春风不度玉门关', from: '王之涣《凉州词》', spot: '玉门关', note: '玉门关外的苍凉与壮阔' },

  // ===== 徽州 / 黄山 =====
  { city: '徽州', region: '安徽', text: '一生痴绝处，无梦到徽州', from: '汤显祖《游黄山白岳不果》', spot: '歙县古城', note: '汤显祖对徽州的极致向往' },
  { city: '黄山', region: '安徽', text: '五岳归来不看山，黄山归来不看岳', from: '徐霞客《漫游黄山仙境》', spot: '黄山', note: '徐霞客对黄山的最高评价' },

  // ===== 桂林 / 广西 =====
  { city: '桂林', region: '广西', text: '桂林山水甲天下', from: '王正功《劝驾诗》', spot: '漓江', note: '南宋起流传至今的桂林定评' },
  { city: '桂林', region: '广西', text: '江作青罗带，山如碧玉篸', from: '韩愈《送桂州严大夫》', spot: '阳朔', note: '以青罗带、碧玉簪喻漓江山水的柔美' },

  // ===== 大理 / 丽江 =====
  { city: '大理', region: '云南', text: '苍山不墨千秋画，洱海无弦万古琴', from: '清代大理楹联', spot: '洱海', note: '苍山洱海的天然意境' },
  { city: '丽江', region: '云南', text: '风花雪月，自在大理', from: '大理四景民间谚语', spot: '下关风·上关花', note: '下关风、上关花、苍山雪、洱海月' },

  // ===== 泉州 =====
  { city: '泉州', region: '福建', text: '此地古称佛国，满街都是圣人', from: '朱熹题泉州开元寺', spot: '开元寺', note: '写尽泉州「世界宗教博物馆」的气象' },
  { city: '泉州', region: '福建', text: '涨海声中万国商', from: '李邴《咏宋代泉州海外交通贸易》', spot: '古刺桐港', note: '海上丝绸之路起点的繁华写照' },

  // ===== 景德镇 =====
  { city: '景德镇', region: '江西', text: '白如玉、明如镜、薄如纸、声如磬', from: '景德镇瓷器四绝', spot: '陶溪川', note: '最精炼的景德镇瓷质定评' },
  { city: '景德镇', region: '江西', text: '工匠八方来，器成天下走', from: '明代景德镇民谚', spot: '御窑厂', note: '「瓷都」千年不熄的窑火' },

  // ===== 济南 / 山东 =====
  { city: '济南', region: '山东', text: '四面荷花三面柳，一城山色半城湖', from: '刘凤诰题大明湖', spot: '大明湖', note: '济南「泉城」的经典写照' },
  { city: '济南', region: '山东', text: '海右此亭古，济南名士多', from: '杜甫《陪李北海宴历下亭》', spot: '历下亭', note: '济南人杰地灵的最早名句' },
];

/* 按城市取文化条目 */
function cultureByCity(city) {
  return CULTURE_DATA.filter(c => c.city === city);
}

/* ---------- StepFun AI 推荐接口 ---------- */
const STEPFUN_CONFIG = {
  // Cloudflare Pages Function 代理（国内可达，解决 StepFun 直连的 CORS 冲突）
  // API Key 只保存在代理服务端，前端不接触，避免泄露
  proxy: 'https://liuda-ai-proxy.pages.dev/api/chat',
  model: 'step-3.7-flash',
};

/**
 * 调用 StepFun AI 生成推荐目的地
 * @param {object} prefs 用户偏好 {interests, budget, transport, distance, companion, note, city, weather}
 * @returns {Promise<Array|null>} 推荐目的地数组，失败返回 null
 */
async function fetchAIRecommendations(prefs) {
  try {
    const catKeys = Object.keys(CATEGORIES).filter(k => k !== 'other').join('/');
    const catNames = Object.keys(CATEGORIES).filter(k => k !== 'other')
      .map(k => `${CATEGORIES[k].name}(${k})`).join('、');
    const picked = (prefs.interests || []).filter(k => CATEGORIES[k] && k !== 'other');
    const pickedNames = picked.map(k => CATEGORIES[k].name).join('、');

    const system = `你是一位专业的周末旅行规划师，擅长根据用户的偏好推荐真实、可执行的目的地。
你必须严格遵守以下输出格式：只输出一个 JSON 数组，不要输出任何解释文字、markdown 代码块或前后缀。
数组里每个元素是一个对象，包含以下字段（全部必填）：
{
  "title": "目的地/活动名称（具体、真实，如「莫干山轻徒步」「苏州园林一日游」）",
  "category": "分类，只能是 ${catKeys} 之一（${catNames}）",
  "location": "具体地点或区域",
  "distance": 距离当前城市的公里数（数字）,
  "cost": 人均花费（数字，元）,
  "transport": "建议交通方式，如 高铁1.5h / 自驾2h / 地铁直达",
  "reason": "推荐理由（一句话，说明为什么适合该用户）",
  "tags": ["2-3个标签"]
}
【最重要的硬性约束】数组里每一个元素的 category 都必须来自用户选定的玩法类型，一个都不能例外。
不要为了让结果看起来丰富就掺入其他类型（例如用户只选了徒步/漂流，就绝对不要出现咖啡馆、Live House、演出、展览、商场）。`;

    const transportName = prefs.transport && prefs.transport !== 'any'
      ? (TRANSPORTS.find(t => t.key === prefs.transport)?.name || prefs.transport) : '不限';
    const distanceName = prefs.distance
      ? (DISTANCES.find(d => d.key === prefs.distance)?.name || prefs.distance) : '不限';
    const companionName = prefs.companion ? (COMPANIONS[prefs.companion] || prefs.companion) : '不限';
    // 每次请求带一个随机因子：避免同一组偏好反复拿到同一批目的地
    const nonce = Math.random().toString(36).slice(2, 8);
    const user = `当前城市：${prefs.city || CITY.name}。
用户偏好：
- 玩法类型（必须严格遵守）：${pickedNames || '不限'}
- 预算：${prefs.budget >= 999999 ? '不限' : prefs.budget + ' 元以内'}
- 交通方式：${transportName}
- 距离范围：${distanceName}
- 同行人数：${companionName}
- 额外需求：${prefs.note || '无'}
- 今日天气：${prefs.weather ? (WEATHERS[prefs.weather]?.name || prefs.weather) : '未知'}

要求：
1. 推荐 8 个符合上述约束的真实周末目的地，每个 destination 必须属于「${pickedNames || '任意'}」中的某一类。
2. 同类目的地之间要在地点、玩法上尽量不同，不要重复同一个地方。
3. 覆盖不同价位和不同距离，方便用户挑。
4. 本次随机因子：${nonce}（请据此给出与常见答案不同的具体地点组合）。`;

    const res = await fetch(STEPFUN_CONFIG.proxy, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: STEPFUN_CONFIG.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.95,
        max_tokens: 8000,
        reasoning_effort: 'low',
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
    // 每个分类准备几张实拍图轮着用，避免 AI 结果一排卡片全是同一张封面
    const CAT_IMGS = {
      hike: ['1551632811-561732d1e306', '1506905925346-21bda4d32df4', '1506744038136-46273834b3fb'],
      mountain: ['1506905925346-21bda4d32df4', '1551632811-561732d1e306', '1506744038136-46273834b3fb'],
      rafting: ['1530866495561-507c9faab2ed', '1476514525535-07fb3b4ae5f1', '1502680390469-be75c86b636f'],
      camp: ['1537565266759-34bbc16be345', '1445308394109-4ec2920981b1', '1478131143081-80f7f84ca84d'],
      bike: ['1485965120184-e220f721d03e', '1506744038136-46273834b3fb', '1476514525535-07fb3b4ae5f1'],
      pick: ['1464965911861-746a04b4bca6', '1498557850523-fd3d118b962e', '1518635017498-87f514b751ba'],
      exhibition: ['1561214115-f2f134cc4912', '1531058020387-3be344556be6', '1489599849927-2ee91cede3ba'],
      market: ['1533900298318-6b8da08a523e', '1528605248644-14dd04022da1'],
      show: ['1470229722913-7c0e2dbbafd3', '1489599849927-2ee91cede3ba', '1528605248644-14dd04022da1'],
      food: ['1501339847302-ac426a4a7cbb', '1543168256-418811576931'],
      other: ['1476514525535-07fb3b4ae5f1', '1531058020387-3be344556be6'],
    };
    return arr.filter(x => x && x.title).map((x, i) => {
      const cat = CATEGORIES[x.category] ? x.category : 'other';
      const pool = CAT_IMGS[cat] || CAT_IMGS.other;
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
        img: uimg(pool[i % pool.length]),
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

/* 获取真实天气（Open-Meteo，免费无需 key；失败返回 null 走降级） */
async function fetchRealWeather(lat, lng) {
  const la = lat ?? CITY.lat;
  const ln = lng ?? CITY.lng;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${ln}`
      + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
      + `&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weather_code ?? data.daily?.weather_code?.[0];
    const temp = data.current?.temperature_2m ?? data.daily?.temperature_2m_max?.[0];
    if (code === undefined) return null;

    // 未来 3 天预报
    const daily = [];
    const dt = data.daily || {};
    const days = ['今天', '明天', '后天'];
    if (Array.isArray(dt.time)) {
      for (let i = 0; i < Math.min(3, dt.time.length); i++) {
        daily.push({
          label: days[i] || dt.time[i],
          type: WMO_TO_WEATHER[dt.weather_code?.[i]] || 'cloudy',
          max: Math.round(dt.temperature_2m_max?.[i] ?? 0),
          min: Math.round(dt.temperature_2m_min?.[i] ?? 0),
          rain: Math.round(dt.precipitation_probability_max?.[i] ?? 0),
        });
      }
    }

    return {
      type: WMO_TO_WEATHER[code] || 'cloudy',
      temp: Math.round(temp),
      feels: data.current?.apparent_temperature != null ? Math.round(data.current.apparent_temperature) : null,
      humidity: data.current?.relative_humidity_2m ?? null,
      wind: data.current?.wind_speed_10m != null ? Math.round(data.current.wind_speed_10m) : null,
      rainProb: data.current?.precipitation_probability ?? dt.precipitation_probability_max?.[0] ?? null,
      code,
      daily,
      updatedAt: new Date(),
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
    id: 'a6', title: '城市骑行 · 环湖落日线', category: 'bike',
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

  /* ---- 户外线：登山 / 漂流 / 露营 / 骑行 / 采摘 ----
     本地兜底池。用户只勾了某一类时，「换一个」需要始终能给出同类结果，
     所以这一类必须有本地数据兜底（AI 不可用也不会串类）。 */
  {
    id: 'b1', title: '莫干山 · 剑池古道登顶', category: 'mountain',
    location: '湖州德清 莫干山', distance: 62, cost: 80,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['登山', '竹海', '避暑'],
    reason: '海拔 720m，竹林遮蔽不暴晒，门票学生半价',
    img: uimg('1506905925346-21bda4d32df4'), rating: 4.7, likes: 412, date: '周日 07:00',
  },
  {
    id: 'b2', title: '大明山 · 悬空栈道一日', category: 'mountain',
    location: '杭州临安 大明山', distance: 88, cost: 110,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['登山', '索道', '云海'],
    reason: '栈道贴崖而建，晴天能看到云海，全程 5 小时',
    img: uimg('1551632811-561732d1e306'), rating: 4.6, likes: 268, date: '周日 06:30',
  },
  {
    id: 'b3', title: '北高峰 · 灵隐后山穿越', category: 'mountain',
    location: '西湖区 北高峰', distance: 8, cost: 0,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['登山', '免费', '地铁可达'],
    reason: '0 元线路，地铁 3 号线转公交直达，2 小时来回',
    img: uimg('1506744038136-46273834b3fb'), rating: 4.5, likes: 531, date: '周六 08:00',
  },
  {
    id: 'b4', title: '浙西大峡谷漂流', category: 'rafting',
    location: '杭州临安 龙岗镇', distance: 85, cost: 158,
    weatherFit: ['sunny'], crowd: '高',
    tags: ['漂流', '激流', '湿身'],
    reason: '全程 3km 落差 80m，晴天水温和，人多好玩',
    img: uimg('1530866495561-507c9faab2ed'), rating: 4.7, likes: 366, date: '周六 10:00',
  },
  {
    id: 'b5', title: '桐庐富春江竹筏漂流', category: 'rafting',
    location: '杭州桐庐 富春江', distance: 72, cost: 120,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['漂流', '竹筏', '江景'],
    reason: '缓流段不刺激但出片，适合怕水又想漂的人',
    img: uimg('1476514525535-07fb3b4ae5f1'), rating: 4.5, likes: 244, date: '周六 13:00',
  },
  {
    id: 'b6', title: '双溪竹海漂流', category: 'rafting',
    location: '杭州余杭 径山', distance: 36, cost: 100,
    weatherFit: ['sunny'], crowd: '中',
    tags: ['漂流', '近郊', '竹海'],
    reason: '离市区 36km，公交+打车可达，不用请假',
    img: uimg('1502680390469-be75c86b636f'), rating: 4.4, likes: 187, date: '周日 14:00',
  },
  {
    id: 'b7', title: '千岛湖星空露营地', category: 'camp',
    location: '杭州淳安 千岛湖', distance: 150, cost: 200,
    weatherFit: ['sunny'], crowd: '低',
    tags: ['露营', '星空', '湖景'],
    reason: '光污染低，秋季星空最清楚，装备可现场租',
    img: uimg('1537565266759-34bbc16be345'), rating: 4.8, likes: 298, date: '周六 16:00',
  },
  {
    id: 'b8', title: '永安山营地过夜 + 滑翔伞', category: 'camp',
    location: '杭州富阳 永安山', distance: 52, cost: 150,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['露营', '滑翔伞', '看日落'],
    reason: '山顶营地，日落和滑翔伞同一个位置解决',
    img: uimg('1445308394109-4ec2920981b1'), rating: 4.6, likes: 223, date: '周六 17:30',
  },
  {
    id: 'b9', title: '安吉云上草原露营', category: 'camp',
    location: '湖州安吉 云上草原', distance: 92, cost: 260,
    weatherFit: ['sunny'], crowd: '高',
    tags: ['露营', '草甸', '团建'],
    reason: '海拔 1168m 的草甸营地，适合 4 人以上一起',
    img: uimg('1478131143081-80f7f84ca84d'), rating: 4.5, likes: 176, date: '周六 15:00',
  },
  {
    id: 'b10', title: '千岛湖环湖绿道骑行', category: 'bike',
    location: '杭州淳安 千岛湖', distance: 150, cost: 80,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['骑行', '绿道', '湖景'],
    reason: '专用骑行道 138km，可只骑最精华的 30km 段',
    img: uimg('1485965120184-e220f721d03e'), rating: 4.8, likes: 452, date: '周日 09:00',
  },
  {
    id: 'b11', title: '之江路 → 湘湖骑行线', category: 'bike',
    location: '滨江 / 萧山 湘湖', distance: 22, cost: 15,
    weatherFit: ['sunny', 'cloudy'], crowd: '低',
    tags: ['骑行', '江景', '共享单车'],
    reason: '15 元共享单车骑完全程，傍晚江风最舒服',
    img: uimg('1485965120184-e220f721d03e'), rating: 4.6, likes: 389, date: '周日 16:30',
  },
  {
    id: 'b12', title: '四明山盘山公路骑行', category: 'bike',
    location: '宁波余姚 四明山', distance: 125, cost: 0,
    weatherFit: ['sunny'], crowd: '低',
    tags: ['骑行', '盘山', '进阶'],
    reason: '连续爬坡 12km，进阶骑车党的周末考场',
    img: uimg('1506744038136-46273834b3fb'), rating: 4.7, likes: 142, date: '周六 07:30',
  },
  {
    id: 'b13', title: '余杭 · 葡萄园现摘现吃', category: 'pick',
    location: '杭州余杭 良渚', distance: 28, cost: 60,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['采摘', '葡萄', '亲子'],
    reason: '9 月正是葡萄尾季，入园免费按斤称',
    img: uimg('1464965911861-746a04b4bca6'), rating: 4.5, likes: 208, date: '周日 10:00',
  },
  {
    id: 'b14', title: '建德 · 猕猴桃采摘一日', category: 'pick',
    location: '杭州建德 三都镇', distance: 118, cost: 80,
    weatherFit: ['sunny', 'cloudy'], crowd: '低',
    tags: ['采摘', '猕猴桃', '近郊'],
    reason: '9-10 月正当季，园区人少，能带走的比买的多',
    img: uimg('1498557850523-fd3d118b962e'), rating: 4.4, likes: 133, date: '周六 09:30',
  },
  {
    id: 'b15', title: '临安 · 山核桃开竿体验', category: 'pick',
    location: '杭州临安 岛石镇', distance: 76, cost: 50,
    weatherFit: ['sunny'], crowd: '低',
    tags: ['采摘', '山核桃', '秋收'],
    reason: '白露开竿是临安一年一度的大事，能跟着上山捡',
    img: uimg('1518635017498-87f514b751ba'), rating: 4.3, likes: 97, date: '周日 08:30',
  },
  {
    id: 'b16', title: '九溪十八涧 · 踩水徒步线', category: 'hike',
    location: '西湖区 九溪', distance: 9, cost: 0,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['徒步', '溪水', '免费'],
    reason: '全程树荫加溪水，9 月走不热，公交直达',
    img: uimg('1551632811-561732d1e306'), rating: 4.7, likes: 604, date: '周日 09:00',
  },
  {
    id: 'b17', title: '徽杭古道 · 两日轻装', category: 'hike',
    location: '杭州临安 颊口', distance: 105, cost: 180,
    weatherFit: ['sunny', 'cloudy'], crowd: '低',
    tags: ['徒步', '古道', '过夜'],
    reason: '经典入门古道 15km，走完住一晚再回',
    img: uimg('1506905925346-21bda4d32df4'), rating: 4.6, likes: 231, date: '周六 08:00',
  },

  /* ---- 城市线补量：展览 / 市集 / 演出 / 美食 ----
     分类标签是手动浏览入口，每类都得有货，所以这几类各补 1-2 条 */
  {
    id: 'c1', title: '杭帮菜 · 老字号三人食', category: 'food',
    location: '上城区 河坊街', distance: 4, cost: 90,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '高',
    tags: ['美食', '本地菜', '人均低'],
    reason: '西湖醋鱼加龙井虾仁，人均 90 吃到撑，雨天照样去',
    img: uimg('1528605248644-14dd04022da1'), rating: 4.6, likes: 726, date: '本周末',
  },
  {
    id: 'c2', title: '深夜食堂 · 夜市小吃街', category: 'food',
    location: '拱墅区 胜利河', distance: 6, cost: 50,
    weatherFit: ['sunny', 'cloudy'], crowd: '高',
    tags: ['美食', '夜市', '人均低'],
    reason: '50 元横扫一条街，晚上 10 点最热闹',
    img: uimg('1501339847302-ac426a4a7cbb'), rating: 4.5, likes: 583, date: '周六 21:00',
  },
  {
    id: 'c3', title: '周末农夫市集 · 本地鲜货', category: 'market',
    location: '西湖区 转塘', distance: 14, cost: 30,
    weatherFit: ['sunny', 'cloudy'], crowd: '中',
    tags: ['市集', '新鲜', '手作'],
    reason: '本地农户直供，30 元能拎一袋当季水果回宿舍',
    img: uimg('1543168256-418811576931'), rating: 4.5, likes: 214, date: '周六 09:00',
  },
  {
    id: 'c4', title: '小剧场话剧《迷路的人》', category: 'show',
    location: '西湖文化广场', distance: 5, cost: 80,
    weatherFit: ['sunny', 'cloudy', 'rain'], crowd: '低',
    tags: ['演出', '话剧', '学生票'],
    reason: '80 元的学生票价，120 座小剧场离演员最近',
    img: uimg('1489599849927-2ee91cede3ba'), rating: 4.7, likes: 187, date: '周六 19:30',
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
  /* ↓↓↓ 以下均为会话态，刷新即归零（见 SESSION_ONLY），不做任何偏好记忆 ↓↓↓ */
  onboarded: false,       // 本轮是否已走完三个问题
  tripPrefs: {            // 本轮出行偏好（引导流收集）
    transport: 'any',     // 交通方式 key
    distance: 'near',     // 距离范围 key
    note: '',             // 额外需求备注
  },
  sessionCats: [],        // 本轮勾选的玩法类型：AI 推荐与「换一个」都锁定在这几类里
  aiRecommended: [],      // 本轮 AI 生成的推荐结果（空则用本地推荐）
};

/* ---------- 存储层 ---------- */
/* ---------- 存储层 ----------
   推荐相关的状态（有没有引导过 / 收到的偏好 / AI 结果 / 筛选条件）全部属于「本次会话」：
   既不写入本地存储，也不从本地存储恢复。
   产品定位是「随机去哪儿」——每次刷新都必须从第一个问题重新开始，不做任何偏好记忆。 */
const SESSION_ONLY = ['onboarded', 'aiRecommended', 'tripPrefs', 'filterPrefs', 'sessionCats'];

/* 把一个 state 洗成「全新的会话态」 */
function freshSession(s) {
  const next = { ...s };
  SESSION_ONLY.forEach(k => {
    next[k] = JSON.parse(JSON.stringify(DEFAULT_STATE[k] ?? null));
  });
  // 兴趣偏好同理不记忆：刷新后回到「一个问题都没答」的状态
  next.user = { ...next.user, interests: [], budget: null, companions: null };
  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return freshSession({ ...DEFAULT_STATE, ...saved });
    }
  } catch (e) { console.warn('读取本地数据失败', e); }
  return freshSession(JSON.parse(JSON.stringify(DEFAULT_STATE)));
}

let state = loadState();

function saveState() {
  try {
    // 推荐相关字段一律不落盘
    const persist = { ...state };
    SESSION_ONLY.forEach(k => { delete persist[k]; });
    persist.user = { ...persist.user, interests: [], budget: null, companions: null };
    localStorage.setItem(STORE_KEY, JSON.stringify(persist));
  }
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
