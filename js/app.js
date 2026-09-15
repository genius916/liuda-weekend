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
let realWeather = null; // 真实天气缓存（null 表示未获取或失败）

function renderHome() {
  const w = getWeather(state.weather);
  const tempStr = realWeather ? `${realWeather.temp}°` : '';

  // 天气 + 预算 hero
  $('#home-hero').innerHTML = `
    <div class="hero-weather" id="weather-toggle">
      <div class="hero-icon">${icon(w.icon)}</div>
      <div>
        <div class="hero-temp">${w.emoji} ${w.name}${tempStr ? ' · ' + tempStr : ''} · ${w.desc}</div>
        <div class="hero-sub">${CITY.name} · ${realWeather ? '实时天气' : '今天适合这样玩'}</div>
      </div>
      <button class="hero-arrow">${icon('arrowRight')}</button>
    </div>
    <div class="hero-budget" id="budget-toggle">
      <div class="hero-icon">${icon('wallet')}</div>
      <div>
        <div class="hero-temp">预算 <b>${fmtCost(state.filterPrefs.budget)}</b> 以内</div>
        <div class="hero-sub">点击调整预算</div>
      </div>
      <button class="hero-arrow">${icon('arrowRight')}</button>
    </div>
  `;

  $('#weather-toggle').addEventListener('click', openWeatherSheet);
  $('#budget-toggle').addEventListener('click', openBudgetSheet);

  // 天气按钮
  $('#btn-weather').innerHTML = icon(w.icon);

  // 分类筛选
  const cats = [['all', '全部'], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.name])];
  $('#home-cats').innerHTML = cats.map(([k, name]) =>
    `<button class="chip ${state.filterPrefs.cat === k ? 'on' : ''}" data-cat="${k}">${name}</button>`
  ).join('');
  $$('#home-cats .chip').forEach(c => c.addEventListener('click', () => {
    state.filterPrefs.cat = c.dataset.cat;
    saveState();
    renderHome();
  }));

  // 推荐列表
  const list = recommend();
  $('#home-reco-sub').textContent = `${list.length} 个活动`;
  if (list.length === 0) {
    $('#home-list').innerHTML = `<div class="empty">${icon('compass')}<p>没有匹配的活动<br>试试放宽预算或切换天气</p></div>`;
  } else {
    $('#home-list').innerHTML = list.map((a, i) => activityCard(a, i)).join('');
    bindActivityCards();
  }
}

function activityCard(a, i) {
  const cat = getCat(a.category);
  const isFav = state.myFavActivities.includes(a.id);
  const fit = a.weatherFit.includes(state.weather);
  return `
    <article class="card act-card" data-id="${a.id}" style="animation-delay:${i * 50}ms">
      <div class="act-img img-ph" data-cat="${a.category}">
        <span class="act-cat" style="background:${cat.bg};color:${cat.color}">${icon(cat.icon)}${cat.name}</span>
        <button class="fav-btn ${isFav ? 'on' : ''}" data-fav="${a.id}">${isFav ? icon('heartFill') : icon('heart')}</button>
      </div>
      <div class="act-body">
        <h3>${a.title}</h3>
        <div class="act-meta">
          <span class="meta-item">${icon('location')}${a.location} · ${a.distance}km</span>
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

/* 天气选择弹层 */
function openWeatherSheet() {
  openSheet(`
    <h3>今日天气</h3>
    <div class="weather-options">
      ${Object.entries(WEATHERS).map(([k, w]) => `
        <button class="weather-opt ${state.weather === k ? 'on' : ''}" data-w="${k}">
          <span class="w-emoji">${w.emoji}</span>
          <span class="w-name">${w.name}</span>
          <span class="w-desc">${w.desc}</span>
        </button>`).join('')}
    </div>
  `);
  $$('.weather-opt').forEach(b => b.addEventListener('click', () => {
    state.weather = b.dataset.w;
    state.filterPrefs.weather = b.dataset.w;
    saveState();
    closeSheet();
    renderHome();
    toast('已切换天气：' + getWeather(b.dataset.w).name);
  }));
}

/* 预算选择弹层 */
function openBudgetSheet() {
  const opts = [30, 50, 100, 200, 500];
  openSheet(`
    <h3>预算范围</h3>
    <div class="budget-options">
      ${opts.map(v => `
        <button class="budget-opt ${state.filterPrefs.budget === v ? 'on' : ''}" data-b="${v}">
          ${v === 500 ? '不限' : '≤ ' + fmtCost(v)}
        </button>`).join('')}
    </div>
  `);
  $$('.budget-opt').forEach(b => b.addEventListener('click', () => {
    state.filterPrefs.budget = parseInt(b.dataset.b);
    state.user.budget = parseInt(b.dataset.b);
    saveState();
    closeSheet();
    renderHome();
    toast('预算已设为 ' + (b.dataset.b === '500' ? '不限' : '≤ ' + fmtCost(parseInt(b.dataset.b))));
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
      <div class="detail-img img-ph">
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
      <div class="g-cover img-ph" data-cover="${coverIdx}"></div>
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
      <div class="g-cover img-ph" style="height:160px"></div>
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

  // 组队筛选按钮（演示）
  $('#btn-team-filter').addEventListener('click', () => toast('筛选：全部类型'));

  // 我的设置（演示）
  $('#btn-me-setting').addEventListener('click', () => toast('设置功能开发中'));

  // 返回顶部按钮
  initBackTop();

  // 顶部导航滚动阴影
  initScrollShadow();

  // 初次渲染
  renderHome();

  // 异步获取真实天气（Open-Meteo，免费无需 key）
  fetchRealWeather().then(rw => {
    if (rw && rw.type !== state.weather) {
      realWeather = rw;
      state.weather = rw.type;
      state.filterPrefs.weather = rw.type;
      saveState();
      if (currentPage === 'home') renderHome();
    } else if (rw) {
      realWeather = rw;
      if (currentPage === 'home') renderHome();
    }
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
