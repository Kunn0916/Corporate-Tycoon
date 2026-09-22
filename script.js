(function(){
  'use strict';

  /* ---------------- Config ---------------- */
  const SAVE_KEY = 'corporateTycoonSave_v1';

  const UPGRADES = [
    { id:'intern',    name:'Intern',            icon:'\u{1F9D1}', baseCost:15,     baseCps:0.1,  desc:'Makes coffee, occasionally works.' },
    { id:'salesrep',  name:'Sales Rep',         icon:'', baseCost:100,    baseCps:1,    desc:'Cold-calls prospects all day.' },
    { id:'manager',   name:'Team Manager',      icon:'', baseCost:600,    baseCps:6,    desc:'Keeps the interns in line.' },
    { id:'marketer',  name:'Marketing Dept.',   icon:'', baseCost:3500,   baseCps:35,   desc:'Runs viral ad campaigns.' },
    { id:'engineer',  name:'Software Engineer', icon:'', baseCost:18000,  baseCps:180,  desc:'Automates literally everything.' },
    { id:'director',  name:'Regional Director', icon:'', baseCost:100000, baseCps:900,  desc:'Oversees a whole region of offices.' },
    { id:'vp',        name:'Vice President',    icon:'', baseCost:600000, baseCps:5200, desc:'Makes big decisions over lunch.' },
    { id:'ceo',       name:'Franchise CEO',     icon:'', baseCost:4200000,baseCps:34000,desc:'Runs an entire subsidiary for you.' },
  ];

  const CLICK_UPGRADES = [
    { id:'clickTraining', name:'Negotiation Training', icon:'', baseCost:50,  mult:2, desc:'Doubles profit per click.' },
    { id:'clickSuit',     name:'Power Suit',           icon:'', baseCost:2000,mult:2, desc:'Doubles profit per click again.' },
    { id:'clickBrand',    name:'Personal Brand',       icon:'', baseCost:80000,mult:2, desc:'Doubles profit per click once more.' },
  ];

  const COST_GROWTH = 1.15;

  /* ---------------- State ---------------- */
  let state = {
    money: 0,
    totalEarned: 0,
    totalClicks: 0,
    perClickBase: 1,
    owned: {},        // id -> count
    clickOwned: {},   // id -> bought (0/1)
    lastTick: Date.now()
  };

  UPGRADES.forEach(u => state.owned[u.id] = 0);
  CLICK_UPGRADES.forEach(u => state.clickOwned[u.id] = 0);

  /* ---------------- Persistence ---------------- */
  function save(silent){
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      if(!silent) toast('Game saved ✔');
    }catch(e){
      toast('Save failed — storage unavailable');
    }
  }

  function load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      // merge carefully so new upgrades added later don't break old saves
      state = Object.assign(state, parsed);
      UPGRADES.forEach(u => { if(!(u.id in state.owned)) state.owned[u.id] = 0; });
      CLICK_UPGRADES.forEach(u => { if(!(u.id in state.clickOwned)) state.clickOwned[u.id] = 0; });
    }catch(e){
      console.warn('Could not load save', e);
    }
  }

  function hardReset(){
    if(!confirm('Reset ALL progress? This cannot be undone.')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  /* ---------------- Derived values ---------------- */
  function costFor(base, count){
    return Math.ceil(base * Math.pow(COST_GROWTH, count));
  }

  function totalCps(){
    return UPGRADES.reduce((sum,u) => sum + u.baseCps * state.owned[u.id], 0);
  }

  function perClick(){
    let val = state.perClickBase;
    CLICK_UPGRADES.forEach(u => {
      if(state.clickOwned[u.id]) val *= u.mult;
    });
    return val;
  }

  /* ---------------- Formatting ---------------- */
  function fmt(n){
    if(n < 1000) return '$' + n.toFixed(n % 1 === 0 ? 0 : 2);
    const units = ['','K','M','B','T','Qa','Qi','Sx','Sp'];
    let tier = Math.floor(Math.log10(n) / 3);
    tier = Math.min(tier, units.length - 1);
    const scaled = n / Math.pow(1000, tier);
    return '$' + scaled.toFixed(2) + units[tier];
  }

  /* ---------------- Rendering ---------------- */
  const moneyDisplay = document.getElementById('moneyDisplay');
  const rateDisplay = document.getElementById('rateDisplay');
  const perClickEl = document.getElementById('perClick');
  const totalEarnedEl = document.getElementById('totalEarned');
  const totalClicksEl = document.getElementById('totalClicks');
  const upgradeList = document.getElementById('upgradeList');
  const clickBtn = document.getElementById('clickBtn');
  const clickWrap = document.getElementById('clickWrap');

  function renderStats(){
    moneyDisplay.textContent = fmt(state.money);
    rateDisplay.textContent = `+${fmt(totalCps())} / sec (auto)`;
    perClickEl.textContent = fmt(perClick());
    totalEarnedEl.textContent = fmt(state.totalEarned);
    totalClicksEl.textContent = state.totalClicks.toLocaleString();
  }

  function renderUpgrades(){
    upgradeList.innerHTML = '';

    // click upgrades first
    CLICK_UPGRADES.forEach(u => {
      const owned = state.clickOwned[u.id];
      const cost = u.baseCost;
      const row = document.createElement('div');
      row.className = 'upgrade' + (owned ? ' locked' : '');
      row.innerHTML = `
        ${u.icon ? `<div class="up-icon">${u.icon}</div>` : ''}
        <div class="up-info">
          <div class="name">${u.name} ${owned ? '<span class="lvl">OWNED</span>' : ''}</div>
          <div class="desc">${u.desc}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      if(owned){
        btn.textContent = 'Owned';
        btn.disabled = true;
      } else {
        btn.textContent = fmt(cost);
        btn.disabled = state.money < cost;
        btn.onclick = () => buyClickUpgrade(u);
      }
      row.appendChild(btn);
      upgradeList.appendChild(row);
    });

    // staff upgrades
    UPGRADES.forEach(u => {
      const count = state.owned[u.id];
      const cost = costFor(u.baseCost, count);
      const row = document.createElement('div');
      row.className = 'upgrade';
      row.innerHTML = `
        ${u.icon ? `<div class="up-icon">${u.icon}</div>` : ''}
        <div class="up-info">
          <div class="name">${u.name} <span class="lvl">Lv. ${count}</span></div>
          <div class="desc">+${fmt(u.baseCps)}/sec each &middot; total <b>${fmt(u.baseCps*count)}/sec</b></div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = fmt(cost);
      btn.disabled = state.money < cost;
      btn.onclick = () => buyStaff(u);
      row.appendChild(btn);
      upgradeList.appendChild(row);
    });
  }

  function renderAll(){
    renderStats();
    renderUpgrades();
    renderOffice();
  }

  /* ---------------- Office Scene ---------------- */
  const office = document.getElementById('office');
  const officeEmpty = document.getElementById('officeEmpty');
  const MAX_SPRITES_PER_ROW = 6;
  const ROW_H = office.clientHeight ? office.clientHeight / UPGRADES.length : 22;
  let prevOwned = {};

  function ensureRow(index){
    let row = office.querySelector(`.office-row[data-idx="${index}"]`);
    if(!row){
      row = document.createElement('div');
      row.className = 'office-row';
      row.dataset.idx = index;
      row.style.bottom = (index * ROW_H) + 'px';
      office.appendChild(row);
    }
    return row;
  }

  function renderOffice(){
    const anyOwned = UPGRADES.some(u => state.owned[u.id] > 0);
    officeEmpty.style.display = anyOwned ? 'none' : 'flex';

    UPGRADES.forEach((u, idx) => {
      if(!u.icon) return;
      const count = state.owned[u.id];
      if(count <= 0) return;
      const row = ensureRow(idx);
      const isNew = (prevOwned[u.id] || 0) < count;
      const shown = Math.min(count, MAX_SPRITES_PER_ROW);

      // rebuild only if the shown count changed, to avoid restarting all walk animations
      if(row.children.length !== shown){
        row.innerHTML = '';
        for(let i = 0; i < shown; i++){
          const sp = document.createElement('div');
          const isNewest = isNew && i === shown - 1;
          sp.className = 'sprite' + (isNewest ? ' enter' : ' walker');
          sp.textContent = u.icon;
          sp.style.setProperty('--walk-dist', (60 + Math.random() * (office.clientWidth - 120)) + 'px');
          if(!isNewest){
            sp.style.animationDuration = (7 + Math.random() * 6) + 's, 1.6s';
            sp.style.animationDelay = (-Math.random() * 8) + 's, ' + (Math.random() * 1.6) + 's';
          } else {
            // pop in first, then switch to walking animation
            setTimeout(() => {
              sp.classList.remove('enter');
              sp.classList.add('walker');
              sp.style.animationDuration = (7 + Math.random() * 6) + 's, 1.6s';
              sp.style.animationDelay = '0s, 0s';
            }, 500);
          }
          if(count > MAX_SPRITES_PER_ROW && i === shown - 1){
            const badge = document.createElement('span');
            badge.className = 'count';
            badge.textContent = '+' + (count - MAX_SPRITES_PER_ROW + 1);
            sp.appendChild(badge);
          }
          row.appendChild(sp);
        }
      } else if(count > MAX_SPRITES_PER_ROW){
        const badge = row.lastElementChild.querySelector('.count');
        if(badge) badge.textContent = '+' + (count - MAX_SPRITES_PER_ROW + 1);
      }
    });

    prevOwned = Object.assign({}, state.owned);
  }

  /* ---------------- Actions ---------------- */
  function earn(amount){
    state.money += amount;
    state.totalEarned += amount;
  }

  function buyStaff(u){
    const cost = costFor(u.baseCost, state.owned[u.id]);
    if(state.money < cost) return;
    state.money -= cost;
    state.owned[u.id] += 1;
    renderAll();
  }

  function buyClickUpgrade(u){
    if(state.clickOwned[u.id]) return;
    if(state.money < u.baseCost) return;
    state.money -= u.baseCost;
    state.clickOwned[u.id] = 1;
    toast(`${u.name} acquired! Click profit boosted.`);
    renderAll();
  }

  function doClick(e){
    const amount = perClick();
    earn(amount);
    state.totalClicks += 1;
    spawnFloat(amount, e);
    renderAll();
  }

  function spawnFloat(amount, e){
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = '+' + fmt(amount);
    const rect = clickBtn.getBoundingClientRect();
    const wrapRect = clickWrap.getBoundingClientRect();
    let x = rect.width/2, y = 10;
    if(e && e.clientX){
      x = e.clientX - wrapRect.left;
      y = e.clientY - wrapRect.top;
    }
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    clickWrap.style.position = 'relative';
    clickWrap.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  let toastTimer;
  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------------- Game loop ---------------- */
  function tick(){
    const now = Date.now();
    const delta = (now - state.lastTick) / 1000;
    state.lastTick = now;
    const cps = totalCps();
    if(cps > 0){
      earn(cps * delta);
      renderStats(); // stats only, avoid re-render thrash of buttons every 200ms
      updateBuyButtonStates();
    }
  }

  function updateBuyButtonStates(){
    // cheaply toggle disabled state without full re-render
    const buttons = upgradeList.querySelectorAll('.buy-btn');
    let i = 0;
    CLICK_UPGRADES.forEach(u => {
      const btn = buttons[i++];
      if(!state.clickOwned[u.id]) btn.disabled = state.money < u.baseCost;
    });
    UPGRADES.forEach(u => {
      const btn = buttons[i++];
      const cost = costFor(u.baseCost, state.owned[u.id]);
      btn.disabled = state.money < cost;
    });
  }

  /* ---------------- Import / Export ---------------- */
  document.getElementById('exportBtn').onclick = () => {
    const data = btoa(JSON.stringify(state));
    const blob = new Blob([data], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corporate-tycoon-save.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast('Save exported ⬇');
  };

  document.getElementById('importBtn').onclick = () => {
    const code = prompt('Paste your exported save code:');
    if(!code) return;
    try{
      const parsed = JSON.parse(atob(code.trim()));
      state = Object.assign(state, parsed);
      save(true);
      renderAll();
      toast('Save imported ✔');
    }catch(e){
      alert('Invalid save code.');
    }
  };

  document.getElementById('saveBtn').onclick = () => save(false);
  document.getElementById('resetBtn').onclick = hardReset;

  /* ---------------- Init ---------------- */
  clickBtn.addEventListener('click', doClick);

  load();
  state.lastTick = Date.now(); // avoid huge offline-catchup jump on first load
  renderAll();

  setInterval(tick, 200);
  setInterval(() => save(true), 5000);
  window.addEventListener('beforeunload', () => save(true));

})();
