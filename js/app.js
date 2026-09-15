/* ============================================
   溜达 · 主应用逻辑
   ============================================ */

/* ---------- 通用工具 ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* 金额格式化 */
function fmtCost(n) { return n === 0 ? '免费' : '¥' + n; }

/* 头像（首字 + 颜色） */
function avatar(name, color) {
  return `<span class="avatar" style="background:${color}">${name ? name[0] : '我'}</span>`;
}

/* ---------- 页面切换 ---------- */
let currentPage = 'home';

function switchPage(page) {
  currentPage = page;
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#page-' + page)?.classList.add('active');
  $$('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.page === page));
  if (page === 'home') renderHome();
  if (page === 'team') renderTeam();
  if (page === 'checkin') renderCheckin();
  if (page === 'guide') renderGuide();
  if (page === 'me') renderMe();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- 弹层 ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grabber"></div>` + html;
  $('#mask').classList.add('show');
  $('#sheet').classList.add('show');
}
function closeSheet() {
  $('#mask').classList.remove('show');
  $('#sheet').classList.remove('show');
  // 清理地图实例，避免重复初始化
  if (typeof window.__lastMapCleanup === 'function') {
    window.__lastMapCleanup();
    window.__lastMapCleanup = null;
  }
}

/* ---------- 首页 ---------- */
let realWeather = null;      // 真实天气缓存（null 表示未获取或失败）
let locating = false;        // 是否正在定位

/* ---------- 城市文化轮播 ----------
   策略：加权随机（定位城市权重更高）+ 不重复优先 + 定时自动切换 + 手动换一条 */
const CULTURE_ROTATE_MS = 30000;   // 自动切换间隔（30 秒）
let currentCulture = null;
let cultureTimer = null;
const shownCultureKeys = new Set();

function cultureKey(c) { return c.city + '|' + c.text; }

/* 按用户特征加权抽取一条文化内容 */
function pickCulture() {
  if (!CULTURE_DATA.length) return null;
  // 权重：定位所在城市 ×4（更贴合用户），其余 ×1
  const weighted = [];
  CULTURE_DATA.forEach(c => {
    const w = c.city === CITY.name ? 4 : 1;
    for (let i = 0; i < w; i++) weighted.push(c);
  });
  // 优先挑没出现过的，保证轮换不重复
  const fresh = weighted.filter(c => !shownCultureKeys.has(cultureKey(c)));
  const pool = fresh.length ? fresh : weighted;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* 切换到下一条文化内容 */
function rotateCulture(silent) {
  const next = pickCulture();
  if (!next) return;
  currentCulture = next;
  shownCultureKeys.add(cultureKey(next));
  // 全部展示过一轮后重置，避免后续只能重复
  if (shownCultureKeys.size >= CULTURE_DATA.length) shownCultureKeys.clear();
  renderCultureCard(silent);
}

/* 只重绘文化卡内容，不重绘整个 hero（避免闪烁） */
function renderCultureCard(silent) {
  const el = document.getElementById('culture-card');
  if (!el || !currentCulture) return;
  const c = currentCulture;
  const isLocal = c.city === CITY.name;
  el.innerHTML = `
    <div class="culture-head">
      <span class="culture-label">${icon('quill')}城市文化</span>
      <button class="culture-shuffle" id="culture-shuffle" aria-label="换一条">${icon('shuffle')}</button>
    </div>
    <div class="culture-text">「${c.text}」</div>
    <div class="culture-meta">
      <span class="culture-from">${c.from}</span>
      <span class="culture-city ${isLocal ? 'local' : ''}">${icon('location')}${c.city}${isLocal ? ' · 你在这儿' : ''}</span>
    </div>
  `;
  if (!silent) {
    el.classList.remove('fade-in');
    void el.offsetWidth;   // 触发重排以重启动画
    el.classList.add('fade-in');
  }
  const btn = document.getElementById('culture-shuffle');
  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    rotateCulture();
  });
}

function startCultureTimer() {
  clearInterval(cultureTimer);
  cultureTimer = setInterval(() => {
    if (document.hidden) return;          // 页面不可见时暂停
    if (currentPage !== 'home') return;   // 不在首页时不切换
    rotateCulture();
  }, CULTURE_ROTATE_MS);
}

/* 城市显示名：省份与城市重复时（如"东京"与"东京都"）不重复拼接 */
function cityDisplay() {
  const n = CITY.name || '';
  const r = CITY.region || '';
  if (!r || r === n || r.includes(n)) return n;
  return n + '·' + r;
}

function renderHome() {
  const w = getWeather(state.weather);
  const tempStr = realWeather ? `${realWeather.temp}°` : '';
  const cityLabel = cityDisplay();

  if (!currentCulture) {
    const first = pickCulture();
    currentCulture = first;
    if (first) shownCultureKeys.add(cultureKey(first));
  }

  // 天气 + 城市文化 hero（天气自动获取；预算已在引导流收集，此处不再重复）
  $('#home-hero').innerHTML = `
    <div class="hero-weather" id="weather-toggle">
      <div class="hero-icon">${icon(w.icon)}</div>
      <div class="hero-info">
        <div class="hero-temp">${w.emoji} ${w.name}${tempStr ? ' · ' + tempStr : ''}</div>
        <div class="hero-sub">${
          locating ? '正在定位你所在的城市…'
          : realWeather ? `${cityLabel} · 实时天气 · 点击看详情`
          : `${cityLabel} · 点击查看今日天气`
        }</div>
      </div>
      <button class="hero-arrow">${icon('arrowRight')}</button>
    </div>
    <div class="hero-culture" id="culture-card"></div>
  `;

  $('#weather-toggle').addEventListener('click', openWeatherSheet);
  renderCultureCard(true);
  startCultureTimer();

  // 点击文化卡（非换一条按钮）查看该城市更多文化内容
  $('#culture-card').addEventListener('click', (e) => {
    if (e.target.closest('.culture-shuffle')) return;
    openCultureSheet();
  });

  // 天气按钮（顶栏图标跟随当前天气，点击同样打开详情）
  $('#btn-weather').innerHTML = icon(w.icon);
  $('#btn-weather').title = `${cityLabel} · ${w.name}${tempStr ? ' ' + tempStr : ''}，点击看今日天气`;

  // 本次随机结果：只有真的摇出结果才渲染（不再有「今天去哪儿」这种需要再点一次的中间页）
  if (state.onboarded && deciderResult) renderDecider();
  else $('#home-decider').innerHTML = '';

  // 推荐区：未完成偏好引导时，先走引导流 + 默认热门推荐
  if (!state.onboarded) {
    $('#home-reco-title').textContent = '周末去哪儿';
    $('#home-reco-sub').textContent = '先看看这些热门好去处';
    renderOnboarding();
    renderDefaultHotList();
    // 标题下移：放到「三个问题」下方，直接领起本地热门推荐
    placeRecoHead('below');
  } else {
    // 进入推荐态：清理初始态的默认热门区块
    const hotOld = $('#home-hot');
    if (hotOld) hotOld.remove();
    // 标题复位：回到推荐列表上方
    placeRecoHead('top');

    // 分类筛选：全部 + 所有真正有内容的分类（本轮勾选的排在前面，方便一眼看到自己在意的）
    const cats = sessionCats();
    const hasData = k => state.activities.some(a => a.category === k)
      || (state.aiRecommended || []).some(a => a.category === k);
    const chipKeys = [
      ...cats.filter(hasData),
      ...PICKABLE_CATS.filter(k => !cats.includes(k) && hasData(k)),
    ];
    if (state.filterPrefs.cat !== 'all' && !chipKeys.includes(state.filterPrefs.cat)) {
      state.filterPrefs.cat = 'all';
    }
    const chipDefs = [['all', '全部'], ...chipKeys.map(k => [k, CATEGORIES[k].name])];
    $('#home-cats').innerHTML = chipDefs.map(([k, name]) =>
      `<button class="chip ${state.filterPrefs.cat === k ? 'on' : ''}" data-cat="${k}">${name}</button>`
    ).join('');
    $$('#home-cats .chip').forEach(c => c.addEventListener('click', () => {
      state.filterPrefs.cat = c.dataset.cat;
      renderHome();
    }));

    // 列表分两种口径：
    // 「全部」= 本轮按勾选类型生成的结果；点具体分类 = 该分类的全部候选（不受勾选限制，
    // 点哪个标签就给哪个分类的活动，保证每个标签都有内容）
    const activeCat = state.filterPrefs.cat;
    let list;
    if (activeCat === 'all') {
      let base = state.aiRecommended.length
        ? state.aiRecommended.filter(inSessionCats)
        : recommend().filter(inSessionCats);
      list = base.filter(a => !deciderResult || a.id !== deciderResult.id);
    } else {
      list = categoryPool(activeCat).filter(a => !(deciderResult && deciderResult.id === a.id));
    }

    if (activeCat === 'all') {
      const catLabel = (cats.length ? cats : chipKeys).map(k => CATEGORIES[k].name).join(' · ');
      if (state.aiRecommended.length) {
        $('#home-reco-title').textContent = 'AI 为你选好了';
        $('#home-reco-sub').textContent = `${catLabel} · 另有 ${list.length} 个备选`;
      } else {
        $('#home-reco-title').textContent = '同类备选';
        $('#home-reco-sub').textContent = `${catLabel} · 共 ${list.length} 个`;
      }
    } else {
      $('#home-reco-title').textContent = `${CATEGORIES[activeCat].name}推荐`;
      $('#home-reco-sub').textContent = `共 ${list.length} 个`;
    }

    if (list.length === 0) {
      $('#home-list').innerHTML = `<div class="empty">${icon('compass')}<p>这个分类暂时没有更多目的地了<br>换个分类或放宽预算试试</p></div>`;
    } else {
      $('#home-list').innerHTML = list.map((a, i) => activityCard(a, i)).join('');
      bindActivityCards();
    }
  }
}

/* 某个分类的候选池：AI 结果 + 本地数据（手动点分类标签时用，不受勾选类型限制） */
function categoryPool(cat) {
  const ai = (state.aiRecommended || []).filter(a => !cat || a.category === cat);
  const local = state.activities.filter(a => !cat || a.category === cat);
  const seen = new Set(ai.map(a => a.title));
  return [...ai, ...local.filter(a => !seen.has(a.title))];
}

/* 本轮勾选的玩法类型 */
function sessionCats() {
  return (state.sessionCats || []).filter(k => CATEGORIES[k]);
}

/* 是否落在本轮勾选的类型内（没勾过则视为不限） */
function inSessionCats(a) {
  const cats = sessionCats();
  return !cats.length || cats.includes(a.category);
}

/* 本轮候选池：AI 结果在前，本地数据按标题去重补齐 */
function sessionPool() {
  const cats = sessionCats();
  const ai = (state.aiRecommended || []).filter(a => !cats.length || cats.includes(a.category));
  const local = state.activities.filter(a => !cats.length || cats.includes(a.category));
  const seen = new Set(ai.map(a => a.title));
  return [...ai, ...local.filter(a => !seen.has(a.title))];
}

/* 预算 / 天气只做「软过滤」：类型一致性是硬约束，预算天气只是尽量满足 */
function refineByPrefs(pool) {
  const { budget } = state.filterPrefs;
  const weather = state.weather;
  const strict = pool.filter(a => (a.cost || 0) <= budget && (!a.weatherFit || a.weatherFit.includes(weather)));
  if (strict.length) return strict;
  const noWeather = pool.filter(a => (a.cost || 0) <= budget);
  if (noWeather.length) return noWeather;
  return pool;
}

/* 打分：本地活动用推荐算法分数，AI 结果按评分折算 */
function recScore(a) {
  const local = recommend().find(x => x.id === a.id);
  return local ? local.score : 1 + (a.rating || 4.5) / 10;
}

/* 组装本次请求的偏好（三个问题的答案） */
function buildPrefs() {
  return {
    interests: sessionCats(),
    budget: state.user.budget || state.filterPrefs.budget,
    transport: state.tripPrefs.transport,
    distance: state.tripPrefs.distance,
    companion: state.user.companions,
    note: state.tripPrefs.note,
    city: CITY.name,
    weather: state.weather,
  };
}

/* 推荐区标题定位
   'below' —— 引导态：标题排在「三个问题」卡片下方，直接领起本地热门推荐
   'top'   —— 推荐态：标题回到推荐列表上方 */
function placeRecoHead(mode) {
  const head = $('#home-reco-head');
  const list = $('#home-list');
  const hot = $('#home-hot');
  if (!head || !list) return;
  if (mode === 'below' && hot) hot.before(head);
  else list.before(head);
}

/* 默认热门推荐（未引导时也展示一批本地热点，避免页面单一） */
function renderDefaultHotList() {
  // 用评分+热度排序取前 4 个作为「热门推荐」
  const hot = state.activities
    .map(a => ({ ...a, hot: a.rating * 10 + Math.log(a.likes + 1) * 10 }))
    .sort((x, y) => y.hot - x.hot)
    .slice(0, 4);
  // 追加一个「本地热门」区块到 home-list 末尾（引导卡片下方）
  // 注意：区块内不再自带小标题，标题由 #home-reco-head 下移后统一领起
  const block = document.createElement('div');
  block.className = 'hot-block';
  block.id = 'home-hot';
  block.innerHTML = `
    <div class="list hot-list">
      ${hot.map((a, i) => activityCard(a, i)).join('')}
    </div>
  `;
  // 移除旧的热门区块后追加
  const old = $('#home-hot');
  if (old) old.remove();
  $('#home-list').after(block);
  // 绑定热门卡片点击
  $$('#home-hot .act-card').forEach(card => card.addEventListener('click', e => {
    if (e.target.closest('.fav-btn')) return;
    openActivityDetail(card.dataset.id);
  }));
  $$('#home-hot .fav-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    toggleFavActivity(b.dataset.fav);
  }));
}

/* ---------- 偏好引导流（三步向导） ---------- */
let obStep = 0;
const obDraft = { interests: [], budget: null, transport: 'any', distance: null, companions: null, note: '' };
const OB_COMPANIONS = [
  { key: 'solo', name: '一个人', desc: '自在随心' },
  { key: 'small', name: '2-3 人', desc: '闺蜜/室友搭子' },
  { key: 'group', name: '4 人以上', desc: '社团/班级团建' },
];

/* 清空本轮问答草稿（每次刷新 / 每推荐完一轮都从头开始，不记上一轮的选择） */
function resetDraft() {
  obDraft.interests = [];
  obDraft.budget = null;
  obDraft.transport = 'any';
  obDraft.distance = null;
  obDraft.companions = null;
  obDraft.note = '';
}

function renderOnboarding() {
  // 隐藏分类筛选（引导完成后再出现）
  $('#home-cats').innerHTML = '';

  if (obStep === 0) {
    $('#home-list').innerHTML = `
      <div class="ob-card">
        <div class="ob-progress"><span class="ob-dot on"></span><span class="ob-dot"></span><span class="ob-dot"></span></div>
        <div class="ob-step-label">第 1 步 · 共 3 步</div>
        <h3 class="ob-title">这周末，想去哪儿野？</h3>
        <p class="ob-sub">户外和城里都能选，可多选</p>
        ${CAT_GROUPS.map(g => {
          const list = PICKABLE_CATS.filter(k => CATEGORIES[k].group === g.key);
          if (!list.length) return '';
          return `
            <div class="ob-block-label">${g.emoji} ${g.name}</div>
            <div class="ob-options ${g.key === 'city' ? 'ob-city' : 'ob-cols-3'}">
              ${list.map(k => {
                const c = CATEGORIES[k];
                return `<button class="ob-opt ${obDraft.interests.includes(k) ? 'on' : ''}" data-cat="${k}">
                  <span class="ii-icon" style="--c:${c.color};--cbg:${c.bg}">${icon(c.icon)}</span>
                  ${c.name}
                </button>`;
              }).join('')}
            </div>`;
        }).join('')}
        <button class="btn btn-primary ob-next" id="ob-next" ${obDraft.interests.length ? '' : 'disabled'}>
          ${obDraft.interests.length ? `下一步（已选 ${obDraft.interests.length} 类）` : '至少选一个'}
        </button>
      </div>
    `;
    $$('#home-list .ob-opt').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.cat;
      const i = obDraft.interests.indexOf(k);
      if (i >= 0) obDraft.interests.splice(i, 1); else obDraft.interests.push(k);
      renderOnboarding();
    }));
    $('#ob-next').addEventListener('click', () => { obStep = 1; renderOnboarding(); });
  }

  if (obStep === 1) {
    // 第 2 步：预算 + 交通方式 + 距离范围 合并在一问里
    $('#home-list').innerHTML = `
      <div class="ob-card">
        <div class="ob-progress"><span class="ob-dot on"></span><span class="ob-dot on"></span><span class="ob-dot"></span></div>
        <div class="ob-step-label">第 2 步 · 共 3 步</div>
        <h3 class="ob-title">预算多少？怎么去？跑多远？</h3>
        <p class="ob-sub">一次选好，人均预算 / 交通 / 距离</p>

        <div class="ob-block-label">💰 人均预算</div>
        <div class="ob-options ob-cols-3">
          ${BUDGETS.map(b => `
            <button class="ob-opt ${obDraft.budget === b.value ? 'on' : ''}" data-b="${b.value}">
              <b>${b.label}</b>
              <span class="ob-opt-desc">${b.desc}</span>
            </button>`).join('')}
        </div>

        <div class="ob-block-label">🚗 交通方式</div>
        <div class="ob-options ob-cols-3">
          ${TRANSPORTS.map(t => `
            <button class="ob-opt ${obDraft.transport === t.key ? 'on' : ''}" data-t="${t.key}">
              <b>${t.name}</b>
              <span class="ob-opt-desc">${t.desc}</span>
            </button>`).join('')}
        </div>

        <div class="ob-block-label">📍 距离范围</div>
        <div class="ob-options ob-cols-2">
          ${DISTANCES.map(d => `
            <button class="ob-opt ${obDraft.distance === d.key ? 'on' : ''}" data-d="${d.key}">
              <b>${d.name}</b>
              <span class="ob-opt-desc">${d.range}</span>
            </button>`).join('')}
        </div>

        <div class="ob-nav">
          <button class="btn btn-ghost" id="ob-back">上一步</button>
          <button class="btn btn-primary ob-next" id="ob-next" ${obDraft.budget ? '' : 'disabled'}>
            ${obDraft.budget ? '下一步' : '选一个预算'}
          </button>
        </div>
      </div>
    `;
    $$('#home-list .ob-opt[data-b]').forEach(b => b.addEventListener('click', () => {
      obDraft.budget = parseInt(b.dataset.b);
      renderOnboarding();
    }));
    $$('#home-list .ob-opt[data-t]').forEach(b => b.addEventListener('click', () => {
      obDraft.transport = b.dataset.t;
      renderOnboarding();
    }));
    $$('#home-list .ob-opt[data-d]').forEach(b => b.addEventListener('click', () => {
      obDraft.distance = b.dataset.d;
      renderOnboarding();
    }));
    $('#ob-back').addEventListener('click', () => { obStep = 0; renderOnboarding(); });
    $('#ob-next').addEventListener('click', () => { obStep = 2; renderOnboarding(); });
  }

  if (obStep === 2) {
    // 第 3 步：同行人数 + 额外需求备注
    $('#home-list').innerHTML = `
      <div class="ob-card">
        <div class="ob-progress"><span class="ob-dot on"></span><span class="ob-dot on"></span><span class="ob-dot on"></span></div>
        <div class="ob-step-label">第 3 步 · 共 3 步</div>
        <h3 class="ob-title">和谁一起？还有别的想法吗？</h3>
        <p class="ob-sub">同行人数 + 你的专属需求（选填）</p>

        <div class="ob-block-label">👥 同行人数</div>
        <div class="ob-options ob-cols-3">
          ${OB_COMPANIONS.map(c => `
            <button class="ob-opt ${obDraft.companions === c.key ? 'on' : ''}" data-c="${c.key}">
              <b>${c.name}</b>
              <span class="ob-opt-desc">${c.desc}</span>
            </button>`).join('')}
        </div>

        <div class="ob-block-label">✍️ 其他需求（选填）</div>
        <div class="field">
          <input type="text" id="ob-note" placeholder="比如：想避开人群、带宠物、有老人小孩、想吃本地菜..." value="${obDraft.note}">
        </div>

        <div class="ob-nav">
          <button class="btn btn-ghost" id="ob-back">上一步</button>
          <button class="btn btn-primary ob-next" id="ob-done" ${obDraft.companions ? '' : 'disabled'}>
            ${obDraft.companions ? 'AI 帮我推荐' : '选同行人数'}
          </button>
        </div>
      </div>
    `;
    $$('#home-list .ob-opt[data-c]').forEach(b => b.addEventListener('click', () => {
      obDraft.companions = b.dataset.c;
      renderOnboarding();
    }));
    $('#ob-note').addEventListener('input', e => { obDraft.note = e.target.value.trim(); });
    $('#ob-back').addEventListener('click', () => { obStep = 1; renderOnboarding(); });
    $('#ob-done').addEventListener('click', finishOnboarding);
  }
}

function finishOnboarding() {
  const cats = obDraft.interests.length ? obDraft.interests.slice() : ['hike', 'mountain', 'camp'];
  state.sessionCats = cats;              // 本轮锁定这几类，AI 推荐与「换一个」都不出界
  state.user.interests = cats.slice();
  state.user.budget = obDraft.budget || 100;
  state.user.companions = obDraft.companions || 'small';
  state.filterPrefs.budget = state.user.budget;
  state.filterPrefs.cat = 'all';
  state.tripPrefs.transport = obDraft.transport || 'any';
  state.tripPrefs.distance = obDraft.distance || 'near';
  state.tripPrefs.note = obDraft.note || '';
  state.onboarded = true;
  obStep = 0;
  // 直接进入推荐：AI 转圈结束后就出结果，中间不再有需要再点一次的界面
  generateRecommendations();
}

/* 生成推荐：优先 StepFun AI，结果必须落在本轮勾选的类型内，失败降级本地同类型推荐 */
async function generateRecommendations() {
  const prefs = buildPrefs();

  deciderResult = null;
  deciderSeen.clear();
  $('#home-decider').innerHTML = '';

  // AI 加载态
  const listEl = $('#home-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="ai-loading">
        <div class="ai-spinner"></div>
        <p>AI 正在为你随机挑一个目的地…</p>
        <span>${sessionCats().map(k => CATEGORIES[k].name).join(' · ')} · ${state.user.budget >= 999999 ? '预算不限' : '≤¥' + state.user.budget} · ${TRANSPORTS.find(t => t.key === state.tripPrefs.transport)?.name || '不限交通'} · ${DISTANCES.find(d => d.key === state.tripPrefs.distance)?.name || '不限距离'}</span>
      </div>
    `;
  }

  const aiResult = await fetchAIRecommendations(prefs);

  // 类型一致性：AI 里混进来的其它类型一律丢掉（用户选了徒步，就不该出现咖啡馆、演出）
  const cats = sessionCats();
  const kept = (aiResult || []).filter(a => !cats.length || cats.includes(a.category));
  const dropped = (aiResult || []).length - kept.length;
  state.aiRecommended = kept;
  if (!kept.length) {
    state.aiRecommended = [];
    toast(aiResult && aiResult.length ? 'AI 结果类型不匹配，已用本地同类型推荐' : 'AI 暂时不可用，先用本地精选推荐');
  } else if (dropped > 0) {
    console.warn(`已过滤 ${dropped} 条类型不符的 AI 结果`);
  }

  // AI 加载完 → 直接摇出本次结果（不再有「今天去哪儿」的中间确认）
  const pool = refineByPrefs(sessionPool());
  if (pool.length) {
    deciderResult = weightedRandom(pool.map(a => ({ ...a, score: recScore(a) })));
    if (deciderResult) deciderSeen.add(deciderResult.id);
  }

  renderHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* 从头再来：清空本轮所有偏好与结果，回到第一个问题（不保留任何记忆） */
function startOver() {
  resetDraft();
  obStep = 0;
  deciderResult = null;
  deciderSeen.clear();
  state.onboarded = false;
  state.aiRecommended = [];
  state.sessionCats = [];
  state.filterPrefs = { cat: 'all', budget: DEFAULT_STATE.filterPrefs.budget, weather: state.weather };
  state.user.interests = [];
  state.user.budget = null;
  state.user.companions = null;
  state.tripPrefs = { transport: 'any', distance: 'near', note: '' };
  saveState();
  if (currentPage !== 'home') switchPage('home'); else renderHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('已清空本轮偏好，重新来一次');
}

/* ---------- 本次随机结果 ----------
   AI 转圈结束就直接渲染这里，没有「纠结去哪儿 / 今天去哪儿」这种需要再点一次的中间页 */
let deciderResult = null;        // 本次摇出的结果
const deciderSeen = new Set();   // 本轮已摇出过的 id，避免连续重复

function renderDecider() {
  const el = $('#home-decider');
  if (!el) return;
  if (!deciderResult) { el.innerHTML = ''; return; }

  const a = deciderResult;
  const cat = getCat(a.category);
  el.innerHTML = `
    <div class="decider-result">
      <div class="dr-head">
        <span class="dr-label">${icon('flame')} 本次结果 · ${cat.name}</span>
        <div class="dr-actions">
          <button class="dr-reroll" id="decider-reroll">${icon('shuffle')} 换一个</button>
          <button class="dr-reroll" id="decider-restart" title="清空偏好，重新回答三个问题">${icon('refresh')} 换玩法</button>
        </div>
      </div>
      <div class="dr-card" data-id="${a.id}" data-cat="${a.category}">
        <div class="dr-cover img-ph" data-cat="${a.category}">
          ${coverImg(a.img, a.category, 'cover-photo')}
          <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
        </div>
        <div class="dr-body">
          <h3>${a.title}</h3>
          <div class="dr-meta">
            <span>${icon('location')} ${a.location} · ${a.distance}km</span>
            <span>${icon('wallet')} ${fmtCost(a.cost)}</span>
          </div>
          <div class="dr-reason">${icon('flame')} ${a.reason}</div>
          <button class="btn btn-primary dr-go" id="decider-go">${icon('arrowRight')} 查看出行方案</button>
        </div>
      </div>
    </div>
  `;
  $('#decider-reroll').addEventListener('click', (e) => { e.stopPropagation(); rollDecider(); });
  $('#decider-restart').addEventListener('click', (e) => { e.stopPropagation(); startOver(); });
  $('#decider-go').addEventListener('click', () => openPlanSheet(a.id));
}

/* 加权随机：在约束候选集内按推荐分数加权抽取 */
function weightedRandom(list) {
  if (!list.length) return null;
  // 分数可能为负，平移到正数区间做权重
  const minScore = Math.min(...list.map(a => a.score));
  const weights = list.map(a => Math.pow(2, (a.score - minScore) / 2)); // 指数放大差异，但保留随机性
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

/* 换一个：只在「本轮勾选的类型」内换。
   用户选了徒步/漂流，这里就绝不会冒出咖啡厅、Live House、演出。
   同类候选摇完一轮后，会向 AI 再要一批同类型目的地（保证结果不固定）。 */
async function rollDecider() {
  const cats = sessionCats();
  const btn = $('#decider-reroll');
  let fresh = refineByPrefs(sessionPool().filter(a => !deciderSeen.has(a.id) && a.id !== deciderResult?.id));

  if (!fresh.length) {
    if (btn) btn.disabled = true;
    const more = await fetchAIRecommendations(buildPrefs());
    if (btn) btn.disabled = false;
    const add = (more || []).filter(a =>
      (!cats.length || cats.includes(a.category)) &&
      !state.aiRecommended.some(x => x.title === a.title)
    );
    if (add.length) {
      state.aiRecommended = [...state.aiRecommended, ...add];
      deciderSeen.clear();
      fresh = refineByPrefs(sessionPool().filter(a => a.id !== deciderResult?.id));
    }
  }

  if (!fresh.length) {
    toast(cats.length
      ? `${cats.map(k => CATEGORIES[k].name).join('/')}这类暂时没有更多目的地了，换个玩法试试`
      : '暂时没有更多目的地了，换个玩法试试');
    return;
  }

  const pick = weightedRandom(fresh.map(a => ({ ...a, score: recScore(a) })));
  if (!pick) return;
  deciderResult = pick;
  deciderSeen.add(pick.id);
  renderHome();   // 连列表一起重绘：新结果不会在下方重复出现
}

/* ---------- 一站式出行方案 ---------- */
function openPlanSheet(activityId) {
  const a = getActivity(activityId);
  if (!a) return;
  const cat = getCat(a.category);
  const w = getWeather(state.weather);
  const fit = a.weatherFit.includes(state.weather);
  const canTeam = state.teams.some(t => t.activityId === a.id);

  openSheet(`
    <div class="plan">
      <div class="plan-cover img-ph" data-cat="${a.category}">
        ${coverImg(a.img, a.category, 'cover-photo')}
        <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
      </div>
      <h2>${a.title}</h2>
      <div class="plan-rate">${icon('star')} ${a.rating} · ${a.likes} 人想去</div>

      <div class="plan-steps">
        <div class="ps-item">
          <div class="ps-num">1</div>
          <div class="ps-body">
            <div class="ps-title">怎么去</div>
            <div class="ps-desc">${a.location}（距你 ${a.distance}km）${a.distance <= 3 ? '，步行或骑行即可达' : '，建议地铁/公交'} </div>
          </div>
        </div>
        <div class="ps-item">
          <div class="ps-num">2</div>
          <div class="ps-body">
            <div class="ps-title">什么时间去</div>
            <div class="ps-desc">${a.date} · 当前天气${fit ? '适合' : '不太适合'}，${w.desc}</div>
          </div>
        </div>
        <div class="ps-item">
          <div class="ps-num">3</div>
          <div class="ps-body">
            <div class="ps-title">花多少</div>
            <div class="ps-desc">${fmtCost(a.cost)}${a.cost > 0 ? ' / 人' : ''}，在你的预算 ${fmtCost(state.filterPrefs.budget)} 内</div>
          </div>
        </div>
        <div class="ps-item">
          <div class="ps-num">4</div>
          <div class="ps-body">
            <div class="ps-title">和谁去</div>
            <div class="ps-desc">${canTeam ? '已有组队，可直接加入' : '暂无组队，可发起一个'}</div>
          </div>
        </div>
      </div>

      <div class="plan-actions">
        <button class="btn btn-outline" id="plan-team">${icon('team')} ${canTeam ? '加入组队' : '发起组队'}</button>
        <button class="btn btn-primary" id="plan-checkin">${icon('checkin')} 去完来打卡</button>
      </div>
    </div>
  `);

  $('#plan-team').addEventListener('click', () => {
    closeSheet();
    if (canTeam) {
      switchPage('team');
    } else {
      openPublishTeam(activityId);
    }
  });
  $('#plan-checkin').addEventListener('click', () => {
    closeSheet();
    openCheckinSheet(activityId);
  });
}

/* 封面图：有图用图（onerror 降级渐变），无图用渐变 */
function coverImg(src, catKey, cls) {
  if (!src) return '';
  return `<img src="${src}" alt="" loading="lazy" class="${cls}"
    onerror="this.remove()" onload="this.classList.add('loaded')">`;
}

function activityCard(a, i) {
  const cat = getCat(a.category);
  const isFav = state.myFavActivities.includes(a.id);
  const fit = a.weatherFit.includes(state.weather);
  const badges = (a.matchReasons || []).map(r => `<span class="match-badge">${icon('check')}${r}</span>`).join('');
  return `
    <article class="card act-card" data-id="${a.id}" style="animation-delay:${i * 50}ms">
      <div class="act-img img-ph" data-cat="${a.category}">
        ${coverImg(a.img, a.category, 'cover-photo')}
        <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
        ${a.isAI ? `<span class="ai-badge">${icon('spark')}AI 推荐</span>` : ''}
        <button class="fav-btn ${isFav ? 'on' : ''}" data-fav="${a.id}">${isFav ? icon('heartFill') : icon('heart')}</button>
      </div>
      <div class="act-body">
        <h3>${a.title}</h3>
        ${badges ? `<div class="match-badges">${badges}</div>` : ''}
        <div class="act-meta">
          <span class="meta-item">${icon('location')}${a.location}${a.distance ? ' · ' + a.distance + 'km' : ''}</span>
          ${a.transport ? `<span class="meta-item">${icon('route')}${a.transport}</span>` : ''}
          <span class="meta-item">${icon('clock')}${a.date}</span>
        </div>
        <div class="act-tags">${a.tags.map(t => `<span class="mini-tag">${t}</span>`).join('')}</div>
        <div class="act-reason ${fit ? '' : 'warn'}">
          ${fit ? icon('flame') : icon('rain')} ${fit ? a.reason : '当前天气不太适合，谨慎选择'}
        </div>
        <div class="act-foot">
          <span class="act-price">${fmtCost(a.cost)}</span>
          <span class="act-rate">${icon('star')} ${a.rating} <span class="likes">${icon('heart')} ${a.likes}</span></span>
        </div>
      </div>
    </article>
  `;
}

function bindActivityCards() {
  $$('.act-card').forEach(card => card.addEventListener('click', e => {
    if (e.target.closest('.fav-btn')) return;
    openActivityDetail(card.dataset.id);
  }));
  $$('.fav-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    toggleFavActivity(b.dataset.fav);
  }));
}

function toggleFavActivity(id) {
  const idx = state.myFavActivities.indexOf(id);
  if (idx >= 0) state.myFavActivities.splice(idx, 1);
  else state.myFavActivities.push(id);
  saveState();
  renderHome();
}

/* 天气详情弹层（天气为自动获取的真实数据，不可手动选择） */
function openWeatherSheet() {
  const w = getWeather(state.weather);
  const rw = realWeather;
  const cityLabel = cityDisplay();

  const metrics = rw ? `
    <div class="weather-grid">
      ${rw.feels != null ? `<div class="wg-item"><b>${rw.feels}°</b><span>体感温度</span></div>` : ''}
      ${rw.humidity != null ? `<div class="wg-item"><b>${rw.humidity}%</b><span>相对湿度</span></div>` : ''}
      ${rw.wind != null ? `<div class="wg-item"><b>${rw.wind}</b><span>风速 km/h</span></div>` : ''}
      ${rw.rainProb != null ? `<div class="wg-item"><b>${rw.rainProb}%</b><span>降水概率</span></div>` : ''}
    </div>` : '';

  const forecast = (rw && rw.daily && rw.daily.length) ? `
    <div class="weather-forecast">
      ${rw.daily.map(d => {
        const dw = getWeather(d.type);
        return `<div class="wf-item">
          <span class="wf-day">${d.label}</span>
          <span class="wf-icon">${dw.emoji}</span>
          <span class="wf-temp">${d.min}° / ${d.max}°</span>
          <span class="wf-rain">${d.rain}%</span>
        </div>`;
      }).join('')}
    </div>` : '';

  openSheet(`
    <h3>${cityLabel} 天气</h3>
    <div class="weather-now">
      <div class="wn-icon">${icon(w.icon, '#10b981')}</div>
      <div class="wn-main">
        <b>${rw ? rw.temp + '°' : '--'}</b>
        <span>${w.emoji} ${w.name} · ${w.desc}</span>
      </div>
    </div>
    ${metrics}
    ${forecast}
    <p class="weather-note">
      天气按你所在位置自动获取（数据来源 Open-Meteo）。推荐结果已据此自动匹配：
      ${state.weather === 'rain' ? '优先推荐室内活动' : state.weather === 'sunny' ? '优先推荐户外活动' : '室内外都可'}。
    </p>
    <button class="btn btn-ghost" style="width:100%" id="weather-refresh">重新定位并刷新天气</button>
  `);

  $('#weather-refresh').addEventListener('click', async () => {
    closeSheet();
    toast('正在重新定位…');
    await initLocationAndWeather();
    renderHome();
  });
}

/* 定位 + 获取天气（启动时与手动刷新都走这里） */
async function initLocationAndWeather() {
  locating = true;
  if (currentPage === 'home') renderHome();

  const loc = await fetchLocation();
  if (loc) {
    CITY = { name: loc.name, region: loc.region, lat: loc.lat, lng: loc.lng };
  }

  const rw = await fetchRealWeather(CITY.lat, CITY.lng);
  locating = false;

  if (rw) {
    realWeather = rw;
    state.weather = rw.type;
    state.filterPrefs.weather = rw.type;
    saveState();
  } else if (loc) {
    // 定位成功但天气失败，至少更新城市名
    saveState();
  }
  return { loc, rw };
}

/* 城市文化详情弹层：展示某城市的全部文化条目，可随机换城市 */
function openCultureSheet(city) {
  const target = city || (currentCulture ? currentCulture.city : CITY.name);
  let items = cultureByCity(target);
  // 该城市暂无收录则退回展示随机三座城市的内容
  if (!items.length) {
    const cities = [...new Set(CULTURE_DATA.map(x => x.city))];
    const pick = cities.sort(() => Math.random() - 0.5).slice(0, 3);
    items = pick.flatMap(c => cultureByCity(c));
  }

  openSheet(`
    <h3>城市文化 · ${target}</h3>
    <p class="culture-sheet-sub">诗词名句与人文知识，带你认识这座城</p>
    <div class="culture-sheet-list">
      ${items.map(i => `
        <div class="culture-item">
          <div class="ci-text">「${i.text}」</div>
          <div class="ci-from">—— ${i.from}</div>
          <div class="ci-spot">${icon('location')}${i.spot}${i.region && i.region !== i.city ? ' · ' + i.region : ''}</div>
          <div class="ci-note">${i.note}</div>
        </div>
      `).join('')}
    </div>
    <button class="btn btn-ghost" style="width:100%" id="culture-other">${icon('shuffle')} 换个城市看看</button>
  `);

  $('#culture-other').addEventListener('click', () => {
    const cities = [...new Set(CULTURE_DATA.map(x => x.city))].filter(x => x !== target);
    const next = cities[Math.floor(Math.random() * cities.length)];
    openCultureSheet(next);
  });
}

/* 预算选择弹层（档位与引导流保持一致：100 元起，去掉几十元档） */
function openBudgetSheet() {
  openSheet(`
    <h3>预算范围</h3>
    <p style="font-size:13px;color:var(--ink-400);margin-bottom:14px">按人均计算</p>
    <div class="budget-options">
      ${BUDGETS.map(b => `
        <button class="budget-opt ${state.filterPrefs.budget === b.value ? 'on' : ''}" data-b="${b.value}">
          <b>${b.label}</b>
          <span>${b.desc}</span>
        </button>`).join('')}
    </div>
  `);
  $$('.budget-opt').forEach(b => b.addEventListener('click', () => {
    const v = parseInt(b.dataset.b);
    state.filterPrefs.budget = v;
    state.user.budget = v;
    saveState();
    closeSheet();
    renderHome();
    toast('预算已设为 ' + (v >= 999999 ? '不限' : '≤ ' + fmtCost(v)));
  }));
}

/* 活动详情 */
function openActivityDetail(id) {
  const a = getActivity(id);
  if (!a) return;
  const cat = getCat(a.category);
  const isFav = state.myFavActivities.includes(id);
  openSheet(`
    <div class="detail">
      <div class="detail-img img-ph" data-cat="${a.category}">
        ${coverImg(a.img, a.category, 'cover-photo')}
        <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
      </div>
      <h2>${a.title}</h2>
      <div class="detail-rate">${icon('star')} ${a.rating} · ${a.likes} 人想去</div>
      <div class="detail-info">
        <div class="di-row">${icon('location')}<span>${a.location}（距你 ${a.distance}km）</span></div>
        <div class="di-row">${icon('clock')}<span>${a.date}</span></div>
        <div class="di-row">${icon('wallet')}<span>${fmtCost(a.cost)}${a.cost > 0 ? ' / 人' : ''}</span></div>
        <div class="di-row">${icon('users')}<span>预计人流：${a.crowd}</span></div>
      </div>
      <div class="detail-tags">${a.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>
      <div class="detail-reason">${icon('flame')} ${a.reason}</div>
      <div class="detail-actions">
        <button class="btn btn-outline" id="detail-fav">${isFav ? icon('heartFill') : icon('heart')} ${isFav ? '已收藏' : '收藏'}</button>
        <button class="btn btn-primary" id="detail-team">${icon('team')} 去组队</button>
      </div>
    </div>
  `);
  $('#detail-fav').addEventListener('click', () => {
    toggleFavActivity(id);
    const b = $('#detail-fav');
    b.innerHTML = state.myFavActivities.includes(id)
      ? `${icon('heartFill')} 已收藏` : `${icon('heart')} 收藏`;
  });
  $('#detail-team').addEventListener('click', () => {
    closeSheet();
    openPublishTeam(id);
  });
}

/* ---------- 组队 ---------- */
function renderTeam() {
  const cats = [['all', '全部'], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.name])];
  $('#team-cats').innerHTML = cats.map(([k, name]) =>
    `<button class="chip ${teamFilter === k ? 'on' : ''}" data-cat="${k}">${name}</button>`
  ).join('');
  $$('#team-cats .chip').forEach(c => c.addEventListener('click', () => {
    teamFilter = c.dataset.cat;
    renderTeam();
  }));

  let list = state.teams;
  if (teamFilter !== 'all') list = list.filter(t => t.tag === teamFilter);

  if (list.length === 0) {
    $('#team-list').innerHTML = `<div class="empty">${icon('users')}<p>还没有相关组队<br>点击底部 + 发起一个吧</p></div>`;
  } else {
    $('#team-list').innerHTML = list.map(teamCard).join('');
    $$('.team-card').forEach(c => c.addEventListener('click', () => openTeamDetail(c.dataset.id)));
    $$('.team-join').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      joinTeam(b.dataset.id);
    }));
  }
}
let teamFilter = 'all';

function teamCard(t) {
  const cat = getCat(t.tag);
  const joined = state.myTeams.includes(t.id);
  const full = t.members.length >= t.maxMembers;
  const progress = Math.round(t.members.length / t.maxMembers * 100);
  return `
    <article class="card team-card" data-id="${t.id}">
      <div class="team-head">
        <div class="icon-badge" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}</div>
        <div class="team-title">
          <h3>${t.title}</h3>
          <span class="team-poster">由 ${t.poster} 发起</span>
        </div>
      </div>
      <div class="team-meta">
        <div class="tm-item">${icon('clock')} ${t.departTime}</div>
        <div class="tm-item">${icon('location')} ${t.meetPoint}</div>
      </div>
      <div class="team-progress">
        <div class="tp-bar"><div class="tp-fill" style="width:${progress}%"></div></div>
        <span class="tp-count">${t.members.length}/${t.maxMembers} 人</span>
      </div>
      <div class="team-avatars">
        ${t.members.map((m, i) => avatar(m, ['#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#ef4444'][i % 6])).join('')}
        ${full ? '' : `<span class="avatar-more">+${t.maxMembers - t.members.length}</span>`}
      </div>
      <button class="btn ${joined ? 'btn-ghost' : full ? 'btn-ghost' : 'btn-primary'} team-join" data-id="${t.id}" ${full && !joined ? 'disabled' : ''}>
        ${joined ? icon('check') + ' 已加入' : full ? '已满员' : icon('plus') + ' 报名加入'}
      </button>
    </article>
  `;
}

function joinTeam(id) {
  const t = getTeam(id);
  if (!t) return;
  if (state.myTeams.includes(id)) return;
  if (t.members.length >= t.maxMembers) { toast('已满员啦'); return; }
  t.members.push(CURRENT_USER.name);
  state.myTeams.push(id);
  saveState();
  renderTeam();
  toast('报名成功，出发前记得联系队长');
}

function openTeamDetail(id) {
  const t = getTeam(id);
  if (!t) return;
  const cat = getCat(t.tag);
  const joined = state.myTeams.includes(id);
  openSheet(`
    <div class="detail">
      <h2>${t.title}</h2>
      <div class="detail-info">
        <div class="di-row">${icon('clock')}<span>${t.departTime}</span></div>
        <div class="di-row">${icon('location')}<span>集合：${t.meetPoint}</span></div>
        <div class="di-row">${icon('users')}<span>${t.members.length}/${t.maxMembers} 人已加入</span></div>
      </div>
      <div class="detail-tags"><span class="chip">${cat.name}</span></div>
      ${t.note ? `<div class="detail-reason">${icon('edit')} ${t.note}</div>` : ''}
      <div class="team-avatars" style="margin:16px 0">
        ${t.members.map((m, i) => avatar(m, ['#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#ef4444'][i % 6])).join('')}
      </div>
      <div class="detail-actions">
        <button class="btn ${joined ? 'btn-ghost' : 'btn-primary'}" id="td-join" ${joined ? 'disabled' : ''}>
          ${joined ? icon('check') + ' 已加入' : icon('plus') + ' 报名加入'}
        </button>
      </div>
    </div>
  `);
  $('#td-join').addEventListener('click', () => { joinTeam(id); closeSheet(); });
}

/* 发布（组队）弹层 */
function openPublishTeam(activityId) {
  const a = activityId ? getActivity(activityId) : null;
  openSheet(`
    <h3>发起组队</h3>
    <div class="field">
      <label>活动名称</label>
      <input type="text" id="p-title" placeholder="如：周日北山徒步看日出" value="${a ? a.title : ''}">
    </div>
    <div class="field">
      <label>出发时间</label>
      <input type="text" id="p-time" placeholder="如：周日 05:00">
    </div>
    <div class="field">
      <label>集合地点</label>
      <input type="text" id="p-point" placeholder="如：学校东门公交站">
    </div>
    <div class="field">
      <label>人数上限</label>
      <select id="p-max">
        ${[2,3,4,5,6,8,10].map(n => `<option value="${n}" ${n === 6 ? 'selected' : ''}>${n} 人</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>备注（选填）</label>
      <textarea id="p-note" placeholder="补充说明，如装备、费用等"></textarea>
    </div>
    <button class="btn btn-primary" style="width:100%" id="p-submit">发布组队</button>
  `);
  $('#p-submit').addEventListener('click', () => {
    const title = $('#p-title').value.trim();
    const time = $('#p-time').value.trim();
    const point = $('#p-point').value.trim();
    const max = parseInt($('#p-max').value);
    const note = $('#p-note').value.trim();
    if (!title || !time || !point) { toast('请填写活动名称、时间和地点'); return; }
    const team = {
      id: uid('t'), title, departTime: time, meetPoint: point,
      members: [CURRENT_USER.name], maxMembers: max,
      tag: a ? a.category : 'other', note, poster: CURRENT_USER.name,
    };
    state.teams.unshift(team);
    state.myTeams.push(team.id);
    saveState();
    closeSheet();
    switchPage('team');
    toast('组队发布成功！');
  });
}

/* ---------- 打卡 ---------- */
function renderCheckin() {
  const total = state.checkins.length;
  const places = new Set(state.checkins.map(c => c.activityId)).size;
  $('#checkin-stats').innerHTML = `
    <div class="cs-item"><b data-num="${total}">0</b><span>打卡次数</span></div>
    <div class="cs-item"><b data-num="${places}">0</b><span>去过地点</span></div>
    <div class="cs-item"><b data-num="${state.user.signCount}">0</b><span>连续签到</span></div>
  `;
  // 数字滚动动画
  $$('#checkin-stats b').forEach((b, i) => {
    const target = parseInt(b.dataset.num, 10);
    setTimeout(() => animateNumber(b, target, 600 + i * 120), 80);
  });

  if (state.checkins.length === 0) {
    $('#checkin-list').innerHTML = `<div class="empty">${icon('checkin')}<p>还没有打卡记录<br>去过的活动可以打卡哦</p></div>`;
  } else {
    $('#checkin-list').innerHTML = state.checkins.map((c, i) => checkinCard(c, i)).join('');
  }
}

function checkinCard(c, i) {
  const a = getActivity(c.activityId);
  const cat = a ? getCat(a.category) : getCat('other');
  return `
    <article class="card checkin-card" style="animation-delay:${i * 50}ms">
      <div class="ck-img img-ph" data-cat="${a.category}">
        ${coverImg(a && a.img, a && a.category, 'cover-photo')}
        <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
        <div class="ck-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</div>
      </div>
      <div class="ck-body">
        <div class="ck-head">
          <h3>${c.title}</h3>
          <span class="ck-date">${c.date}</span>
        </div>
        <p class="ck-note">${c.note}</p>
        <div class="ck-foot">${icon('heart')} ${c.likes} 人点赞</div>
      </div>
    </article>
  `;
}

/* 足迹地图：Leaflet + OpenStreetMap，免费无需密钥 */
function openFootprintMap() {
  openSheet(`
    <h3>我的探索足迹</h3>
    <div id="footprint-map" style="height:360px;border-radius:var(--r-md);overflow:hidden;z-index:0;"></div>
    <p style="font-size:12px;color:var(--ink-400);margin-top:10px;text-align:center;">
      已点亮 ${state.checkins.length} 个地点 · 地图由 OpenStreetMap 提供
    </p>
  `);

  // 延迟到弹层动画完成后再初始化地图（否则尺寸为 0）
  setTimeout(() => {
    const elMap = document.getElementById('footprint-map');
    if (!elMap || typeof L === 'undefined') return;

    // 取打卡点坐标，无坐标则用杭州中心
    const points = state.checkins.filter(c => c.lat && c.lng);
    const center = points.length
      ? [points[0].lat, points[0].lng]
      : [30.2741, 120.1551];

    const map = L.map('footprint-map', { scrollWheelZoom: false }).setView(center, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // 自定义薄荷色打卡标记
    const markerIcon = L.divIcon({
      className: 'ld-marker',
      html: `<div class="ld-marker-pin"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });

    points.forEach(c => {
      L.marker([c.lat, c.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`<b>${c.title}</b><br>${c.date} · 评分 ${c.rating} 星`);
    });

    // 有多个点时自动缩放视野
    if (points.length > 1) {
      map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    }

    // 关闭弹层时销毁地图，避免重复初始化报错
    const onClose = () => {
      map.remove();
      $('#mask').removeEventListener('click', onClose);
    };
    // 用一次性标记，供 closeSheet 后清理
    window.__lastMapCleanup = onClose;
  }, 350);
}

function openCheckinSheet(activityId) {
  const a = activityId ? getActivity(activityId) : null;
  openSheet(`
    <h3>发布打卡</h3>
    <div class="field">
      <label>地点</label>
      <input type="text" id="ck-title" placeholder="去了哪里" value="${a ? a.title : ''}">
    </div>
    <div class="field">
      <label>评分</label>
      <div class="star-input" id="ck-stars">
        ${[1,2,3,4,5].map(i => `<button data-s="${i}">${icon('starEmpty')}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>照片（选填）</label>
      <div class="photo-grid">
        <div class="photo-cell" id="ck-photo-add">${icon('camera')}</div>
        <div class="photo-cell">${icon('plus')}</div>
        <div class="photo-cell">${icon('plus')}</div>
      </div>
    </div>
    <div class="field">
      <label>评价</label>
      <textarea id="ck-note" placeholder="一句话记录这次体验"></textarea>
    </div>
    <button class="btn btn-primary" style="width:100%" id="ck-submit">发布打卡</button>
  `);

  let rating = 0;
  $$('#ck-stars button').forEach((b, idx) => {
    b.addEventListener('click', () => {
      rating = idx + 1;
      $$('#ck-stars button').forEach((bb, i) => bb.innerHTML = i < rating ? icon('star') : icon('starEmpty'));
    });
  });

  // 模拟选图
  $('#ck-photo-add').addEventListener('click', () => {
    $('#ck-photo-add').innerHTML = `<img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23a7f3d0'/><circle cx='100' cy='80' r='30' fill='%2310b981'/><rect x='40' y='130' width='120' height='50' rx='6' fill='%23059669'/></svg>">`;
    toast('照片已添加（演示）');
  });

  $('#ck-submit').addEventListener('click', () => {
    const title = $('#ck-title').value.trim();
    const note = $('#ck-note').value.trim();
    if (!title) { toast('请填写地点'); return; }
    if (!rating) { toast('请打个分吧'); return; }
    const ck = {
      id: uid('c'), activityId: a ? a.id : 'other', title,
      date: '2026-09-' + String(new Date().getDate()).padStart(2, '0'),
      note: note || '体验不错！', rating, img: '', likes: 0,
    };
    state.checkins.unshift(ck);
    state.user.checkinCount++;
    saveState();
    closeSheet();
    renderCheckin();
    toast('打卡成功！');
  });
}

/* ---------- 攻略 ---------- */
let guideTag = '全部';
let guideKeyword = '';

function renderGuide() {
  const tags = GUIDE_TAGS.map(t =>
    `<button class="chip ${guideTag === t ? 'on' : ''}" data-tag="${t}">${t}</button>`
  ).join('');
  $('#guide-tags').innerHTML = tags;
  $$('#guide-tags .chip').forEach(c => c.addEventListener('click', () => {
    guideTag = c.dataset.tag;
    renderGuide();
  }));

  let list = state.guides;
  if (guideTag !== '全部') list = list.filter(g => g.tags.includes(guideTag));
  if (guideKeyword) list = list.filter(g =>
    (g.title + g.excerpt + g.tags.join('') + g.author).toLowerCase().includes(guideKeyword.toLowerCase())
  );

  if (list.length === 0) {
    $('#guide-list').innerHTML = `<div class="empty">${icon('guide')}<p>没有找到相关攻略</p></div>`;
  } else {
    $('#guide-list').innerHTML = list.map(guideCard).join('');
    $$('.guide-card').forEach(c => c.addEventListener('click', () => openGuideDetail(c.dataset.id)));
    $$('.g-fav').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavGuide(b.dataset.id);
    }));
  }
}

function guideCard(g) {
  const isFav = state.myFavGuides.includes(g.id);
  const coverIdx = parseInt(g.id.replace(/\D/g, '') || '0', 10) % 5;
  return `
    <article class="card guide-card" data-id="${g.id}">
      <div class="g-cover img-ph" data-cover="${coverIdx}">
        ${coverImg(g.cover, '', 'cover-photo')}
      </div>
      <div class="g-body">
        <h3>${g.title}</h3>
        <p class="g-excerpt">${g.excerpt}</p>
        <div class="g-tags">${g.tags.map(t => `<span class="mini-tag">#${t}</span>`).join('')}</div>
        <div class="g-foot">
          <span class="g-author">${avatar(g.author, g.avatarColor)} ${g.author}</span>
          <span class="g-stats">${icon('eye')} ${g.read} &nbsp; ${icon('heart')} ${g.likes}</span>
          <button class="g-fav ${isFav ? 'on' : ''}" data-id="${g.id}">${isFav ? icon('bookmarkFill') : icon('bookmark')}</button>
        </div>
      </div>
    </article>
  `;
}

function toggleFavGuide(id) {
  const idx = state.myFavGuides.indexOf(id);
  if (idx >= 0) { state.myFavGuides.splice(idx, 1); state.user.favCount = Math.max(0, state.user.favCount - 1); }
  else { state.myFavGuides.push(id); state.user.favCount++; }
  saveState();
  renderGuide();
}

function openGuideDetail(id) {
  const g = state.guides.find(x => x.id === id);
  if (!g) return;
  const isFav = state.myFavGuides.includes(id);
  openSheet(`
    <div class="detail guide-detail">
      <div class="g-cover img-ph" style="height:160px">
        ${coverImg(g.cover, '', 'cover-photo')}
      </div>
      <h2>${g.title}</h2>
      <div class="g-author-row">${avatar(g.author, g.avatarColor)} ${g.author} · ${g.read} 阅读</div>
      <div class="g-tags">${g.tags.map(t => `<span class="chip">#${t}</span>`).join('')}</div>
      <p class="gd-content">${g.excerpt}</p>
      <p class="gd-content" style="color:var(--ink-400)">（完整图文攻略内容占位，后续可接入编辑器）</p>
      <div class="detail-actions">
        <button class="btn btn-outline" id="gd-fav">${isFav ? icon('bookmarkFill') : icon('bookmark')} ${isFav ? '已收藏' : '收藏'}</button>
        <button class="btn btn-ghost" id="gd-share">${icon('share')} 分享</button>
      </div>
    </div>
  `);
  $('#gd-fav').addEventListener('click', () => {
    toggleFavGuide(id);
    closeSheet();
  });
  $('#gd-share').addEventListener('click', () => toast('分享链接已复制（演示）'));
}

/* ---------- 我的 ---------- */
function renderMe() {
  const u = state.user;
  $('#me-profile').innerHTML = `
    <div class="me-avatar" style="background:${u.avatarColor}">${u.name[0]}</div>
    <div class="me-info">
      <h3>${u.name}</h3>
      <span>杭州 · 已探索 ${u.checkinCount} 个地方</span>
    </div>
    <button class="btn btn-outline" id="me-edit">${icon('edit')} 编辑</button>
  `;

  $('#me-menu').innerHTML = `
    <div class="me-stats">
      <div class="ms-item"><b data-num="${u.signCount}">0</b><span>连续签到</span></div>
      <div class="ms-item"><b data-num="${state.checkins.length}">0</b><span>打卡</span></div>
      <div class="ms-item"><b data-num="${u.favCount}">0</b><span>收藏</span></div>
      <div class="ms-item"><b data-num="${state.myTeams.length}">0</b><span>组队</span></div>
    </div>
    <div class="me-list">
      <button class="me-row" id="me-favs">${icon('heart')}<span>我的收藏</span>${icon('arrowRight')}</button>
      <button class="me-row" id="me-teams">${icon('team')}<span>我的组队</span>${icon('arrowRight')}</button>
      <button class="me-row" id="me-checkins">${icon('checkin')}<span>我的足迹</span>${icon('arrowRight')}</button>
      <button class="me-row" id="me-guides">${icon('guide')}<span>我的攻略</span>${icon('arrowRight')}</button>
    </div>
    <div class="me-list">
      <button class="me-row" id="me-interest">${icon('flame')}<span>兴趣偏好</span>${icon('arrowRight')}</button>
      <button class="me-row" id="me-reonboard">${icon('compass')}<span>重新随机（清空偏好）</span>${icon('arrowRight')}</button>
      <button class="me-row" id="me-about">${icon('compass')}<span>关于溜达</span>${icon('arrowRight')}</button>
    </div>
  `;

  // 数字滚动动画
  $$('.me-stats b').forEach((b, i) => {
    const target = parseInt(b.dataset.num, 10);
    setTimeout(() => animateNumber(b, target, 600 + i * 100), 80);
  });

  $('#me-edit').addEventListener('click', openEditName);
  $('#me-favs').addEventListener('click', () => { switchPage('guide'); guideTag = '全部'; renderGuide(); });
  $('#me-teams').addEventListener('click', () => { switchPage('team'); teamFilter = 'all'; renderTeam(); });
  $('#me-checkins').addEventListener('click', () => switchPage('checkin'));
  $('#me-interest').addEventListener('click', openInterestSheet);
  $('#me-reonboard').addEventListener('click', startOver);
  $('#me-about').addEventListener('click', () => openSheet(`
    <h3>关于溜达</h3>
    <p style="color:var(--ink-500);line-height:1.7;font-size:14px">
      「溜达」是一款面向大学生的周末城市探索工具，帮你解决「周末去哪儿」的选择困难。
      智能推荐、组队出发、打卡记录、攻略分享，让每个周末都有事可做、有人同行。<br><br>
      周末不宅，去溜达。
    </p>
  `));
}

function openEditName() {
  openSheet(`
    <h3>编辑资料</h3>
    <div class="field">
      <label>昵称</label>
      <input type="text" id="edit-name" value="${state.user.name}">
    </div>
    <button class="btn btn-primary" style="width:100%" id="edit-save">保存</button>
  `);
  $('#edit-save').addEventListener('click', () => {
    const name = $('#edit-name').value.trim();
    if (!name) { toast('昵称不能为空'); return; }
    state.user.name = name;
    saveState();
    closeSheet();
    renderMe();
    toast('已保存');
  });
}

function openInterestSheet() {
  openSheet(`
    <h3>兴趣偏好</h3>
    <p style="font-size:13px;color:var(--ink-400);margin-bottom:16px">选择你感兴趣的活动类型，推荐会更懂你</p>
    <div class="interest-grid">
      ${Object.entries(CATEGORIES).map(([k, c]) => {
        const on = state.user.interests.includes(k);
        return `<button class="interest-item ${on ? 'on' : ''}" data-cat="${k}" style="--c:${c.color};--cbg:${c.bg}">
          <span class="ii-icon">${icon(c.icon)}</span>${c.name}
        </button>`;
      }).join('')}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:20px" id="interest-save">保存</button>
  `);
  $$('.interest-item').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
  $('#interest-save').addEventListener('click', () => {
    state.user.interests = $$('.interest-item.on').map(b => b.dataset.cat);
    saveState();
    closeSheet();
    toast('偏好已更新');
  });
}

/* ---------- 事件绑定 ---------- */
function init() {
  // Tab 切换
  $$('.tab-item').forEach(t => t.addEventListener('click', () => {
    const page = t.dataset.page;
    if (page === 'publish') {
      openPublishTeam(null);
      return;
    }
    switchPage(page);
  }));

  // 遮罩点击关闭
  $('#mask').addEventListener('click', closeSheet);

  // 攻略搜索
  let searchTimer = null;
  $('#guide-search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      guideKeyword = e.target.value.trim();
      renderGuide();
    }, 250);
  });
  $('#btn-guide-search').addEventListener('click', () => $('#guide-search-input').focus());

  // 打卡地图按钮（演示）
  $('#btn-checkin-map').addEventListener('click', () => {
    openFootprintMap();
  });

  // 通知按钮（演示）
  $('#btn-notice').addEventListener('click', () => toast('暂无新通知'));

  // 顶栏天气按钮：打开今日天气详情（此前漏绑事件，点上去没反应）
  $('#btn-weather').addEventListener('click', openWeatherSheet);

  // 组队筛选按钮（演示）
  $('#btn-team-filter').addEventListener('click', () => toast('筛选：全部类型'));

  // 我的设置（演示）
  $('#btn-me-setting').addEventListener('click', () => toast('设置功能开发中'));

  // 返回顶部按钮
  initBackTop();

  // 顶部导航滚动阴影
  initScrollShadow();

  // demo 模式（?demo=1）：跳过三个问题，直接用一组默认玩法跑完整流程，方便演示与评审
  const demoMode = new URLSearchParams(location.search).has('demo');
  if (demoMode) {
    obDraft.interests = ['hike', 'mountain', 'camp'];
    obDraft.budget = 300;
    obDraft.distance = 'near';
    obDraft.companions = 'small';
    state.sessionCats = obDraft.interests.slice();
    state.user.interests = obDraft.interests.slice();
    state.user.budget = 300;
    state.user.companions = 'small';
    state.filterPrefs.budget = 300;
    state.tripPrefs = { transport: 'any', distance: 'near', note: '' };
    state.onboarded = true;
  }

  // 初次渲染
  renderHome();
  if (demoMode) generateRecommendations();

  // 异步：IP 定位 → 拉取当地实时天气（免费，无需 key）
  initLocationAndWeather().then(() => {
    if (currentPage === 'home') renderHome();
  });
}

/* ---------- 返回顶部 ---------- */
function initBackTop() {
  const btn = el(`<button class="back-top" id="back-top" aria-label="返回顶部">${icon('back')}</button>`);
  document.getElementById('app').appendChild(btn);
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
}

/* ---------- 顶部导航滚动阴影 ---------- */
function initScrollShadow() {
  const bar = $('#tabbar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    bar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

/* ---------- 数字滚动动画 ---------- */
function animateNumber(el, target, duration = 800) {
  const start = performance.now();
  const from = 0;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const val = Math.round(from + (target - from) * eased);
    el.textContent = val;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

document.addEventListener('DOMContentLoaded', init);
