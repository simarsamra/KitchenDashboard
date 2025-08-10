/* app.js
   Kitchen Dashboard - single-page app
   - Offline-first: bundled recipes.json -> localStorage -> remote URL
   - Weather: OpenWeatherMap (API key + city in Settings)
   - Google Calendar: client-side OAuth (set client id in Settings)
*/

// ---------- Config keys ----------
const LOCAL_RECIPES_KEY = 'kr_recipes_v1';
const REMOTE_URL_KEY = 'kr_remote_url';
const OWM_KEY = 'kr_owm_key';
const OWM_CITY = 'kr_owm_city';
const GCLIENT_KEY = 'kr_gclient_id';

// ---------- DOM ----------
const timeEl = document.getElementById('time');
const dateEl = document.getElementById('date');
const weatherSummary = document.getElementById('weather-summary');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');

const viewContainer = document.getElementById('view-container');
const pages = document.querySelectorAll('.view-page');
const navBtns = document.querySelectorAll('.nav-btn');

const todayMealEl = document.getElementById('today-meal');
const prepNowEl = document.getElementById('prep-now');
const recipeContent = document.getElementById('recipe-content');
const groceryListEl = document.getElementById('grocery-list');
const eventsCard = document.getElementById('events-card');
const weatherCard = document.getElementById('weather-card');
const prepListEl = document.getElementById('prep-list');

const settingsModal = document.getElementById('settingsModal');
const remoteUrlInput = document.getElementById('remoteUrl');
const owmKeyInput = document.getElementById('owmKey');
const owmCityInput = document.getElementById('owmCity');
const gclientInput = document.getElementById('gclientId');
const saveSettingsBtn = document.getElementById('saveSettings');
const closeSettingsBtn = document.getElementById('closeSettings');

const gcalSignInBtn = document.getElementById('gcalSignIn');
const gcalSignOutBtn = document.getElementById('gcalSignOut');

const refreshRecipesBtn = document.getElementById('refreshBtn');
const clearCheckedBtn = document.getElementById('clearChecked');
const exportGroceryBtn = document.getElementById('exportGrocery');

// ---------- Utilities ----------
function formatTime(dt) {
  return dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function formatDate(dt) {
  return dt.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}
function saveToStorage(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function loadFromStorage(key){ const v = localStorage.getItem(key); return v? JSON.parse(v): null; }

// ---------- Clock ----------
function tickClock(){
  const now = new Date();
  timeEl.textContent = formatTime(now);
  dateEl.textContent = formatDate(now);
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Navigation ----------
function showView(name){
  pages.forEach(p => p.classList.add('hidden'));
  const page = document.getElementById('view-'+name);
  if (page) page.classList.remove('hidden');
}
navBtns.forEach(b => b.addEventListener('click', e => {
  const v = e.currentTarget.dataset.view;
  showView(v);
  if (v === 'recipe') renderTodayRecipe();
  if (v === 'grocery') renderGrocery();
  if (v === 'calendar') renderCalendarEvents();
  if (v === 'prep') renderPrepAhead();
}));

document.querySelectorAll('.back').forEach(b => b.addEventListener('click', e => {
  showView(e.currentTarget.dataset.view || 'dashboard');
}));

// ---------- Load Recipes (remote -> storage -> bundled)
async function fetchBundled() {
  const r = await fetch('recipes.json');
  return r.json();
}

async function loadRecipes() {
  // 1. attempt remote if configured
  const remoteUrl = localStorage.getItem(REMOTE_URL_KEY);
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, {cache: 'no-store'});
      if (res.ok) {
        const data = await res.json();
        saveToStorage(LOCAL_RECIPES_KEY, data);
        return data;
      } else {
        console.warn('Remote fetch failed, status', res.status);
      }
    } catch (err) {
      console.warn('Remote fetch error', err);
    }
  }
  // 2. attempt localStorage cache
  const cached = loadFromStorage(LOCAL_RECIPES_KEY);
  if (cached) return cached;
  // 3. bundled fallback
  const bundled = await fetchBundled();
  saveToStorage(LOCAL_RECIPES_KEY, bundled);
  return bundled;
}

// helper: rotation index for date (0..rotation_days-1)
function getRotationIndexForDate(d, rotationDays = 4) {
  // Use day-of-month modulo rotationDays for deterministic cycle
  return (d.getDate() % rotationDays);
}

// Given category array, choose 2 recipes for given rotation index
function chooseRecipesForCategory(categoryArr, dayIndex) {
  if (!Array.isArray(categoryArr) || categoryArr.length === 0) return [];
  // pick 2 starting at offset dayIndex*2
  const start = (dayIndex * 2) % Math.max(1, categoryArr.length);
  const items = [];
  for (let i=0;i<2;i++){
    items.push(categoryArr[(start + i) % categoryArr.length]);
  }
  return items;
}

// ---------- Render Today's Recipe (based on current time of day)
function mealPeriodByHour(h){
  if (h < 10) return 'Breakfast';
  if (h < 15) return 'Lunch';
  if (h < 21) return 'Dinner';
  return 'Spare';
}

async function renderTodayRecipe(){
  const data = await loadRecipes();
  const rotationDays = data.rotation_days || 4;
  const dayIndex = getRotationIndexForDate(new Date(), rotationDays);
  const now = new Date();
  const meal = mealPeriodByHour(now.getHours());
  const catArr = data.recipes[meal] || [];
  const selected = chooseRecipesForCategory(catArr, dayIndex);
  recipeContent.innerHTML = '';
  if (selected.length === 0) {
    recipeContent.innerHTML = '<p>No recipe for this meal.</p>';
    return;
  }
  selected.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    let html = `<h3>${r.title}</h3>`;
    if (r.prepNotes) html += `<div class="small-muted"><strong>Prep:</strong> ${r.prepNotes}</div>`;
    if (r.ingredients && r.ingredients.length){
      html += '<h4>Ingredients</h4><ul>';
      r.ingredients.forEach(i => {
        html += `<li>${i.qty||''} ${i.unit||''} ${i.name}</li>`;
      });
      html += '</ul>';
    }
    if (r.steps && r.steps.length){
      html += '<h4>Steps</h4><ol class="recipe-steps">';
      r.steps.forEach(s => html += `<li>${s}</li>`);
      html += '</ol>';
    }
    card.innerHTML = html;
    recipeContent.appendChild(card);
  });
}

// ---------- Generate weekly grocery list (aggregate over next 7 days)
async function generateWeeklyPlanDays(days=7){
  const data = await loadRecipes();
  const rotationDays = data.rotation_days || 4;
  const out = [];
  const today = new Date();
  for (let i=0;i<days;i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayIndex = getRotationIndexForDate(d, rotationDays);
    const dayMeals = {};
    for (const cat of Object.keys(data.recipes)){
      const catArr = data.recipes[cat];
      const chosen = chooseRecipesForCategory(catArr, dayIndex);
      dayMeals[cat] = chosen;
    }
    out.push({date: d.toISOString().slice(0,10), meals: dayMeals});
  }
  return out;
}

function addToAggregate(agg, ing) {
  // Use name as key (lowercase) to combine; simple numeric addition if qty given and unit same
  const key = ing.name.toLowerCase();
  if (!agg[key]) {
    agg[key] = {name: ing.name, qty: ing.qty || null, unit: ing.unit || ''};
  } else {
    // attempt combine if both have numeric qty and same unit
    const cur = agg[key];
    if (typeof cur.qty === 'number' && typeof ing.qty === 'number' && cur.unit === (ing.unit||'')) {
      cur.qty = Math.round((cur.qty + ing.qty) * 100) / 100;
    } else {
      // otherwise, append note by making unit field descriptive
      cur.unit = cur.unit || '';
      cur.qty = cur.qty || '';
      cur.qty = `${cur.qty} + ${ing.qty||''}`.trim();
    }
  }
}

async function renderGrocery(){
  groceryListEl.innerHTML = '<li>Loading…</li>';
  const plan = await generateWeeklyPlanDays(7);
  const agg = {};
  plan.forEach(day => {
    for (const cat of Object.keys(day.meals)){
      const meals = day.meals[cat];
      meals.forEach(recipe => {
        (recipe.ingredients||[]).forEach(i => addToAggregate(agg, i));
      });
    }
  });
  // convert to list
  groceryListEl.innerHTML = '';
  const keys = Object.keys(agg).sort();
  keys.forEach(k => {
    const item = agg[k];
    const li = document.createElement('li');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.key = k;
    // load checked state from storage
    const checked = loadFromStorage('gch_' + k) || false;
    cb.checked = checked;
    cb.addEventListener('change', e=>{
      localStorage.setItem('gch_' + k, e.target.checked);
    });
    li.appendChild(cb);
    const span = document.createElement('span');
    span.textContent = `${item.qty ? (item.qty + ' ' + item.unit + ' ') : ''}${item.name}`;
    li.appendChild(span);
    groceryListEl.appendChild(li);
  });
}

// clear checked grocery items
clearCheckedBtn.addEventListener('click', ()=>{
  document.querySelectorAll('#grocery-list input[type=checkbox]').forEach(cb=>{
    if (cb.checked) {
      localStorage.removeItem('gch_' + cb.dataset.key);
      cb.checked = false;
    }
  });
});

// export grocery to .txt
exportGroceryBtn.addEventListener('click', async ()=>{
  const items = [];
  document.querySelectorAll('#grocery-list li span').forEach(s=> items.push(s.textContent));
  const blob = new Blob([items.join('\n')], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'grocery.txt'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
});

// ---------- Weather (OpenWeatherMap)
async function fetchWeather() {
  const key = localStorage.getItem(OWM_KEY);
  const city = localStorage.getItem(OWM_CITY) || '';
  if (!key || !city) {
    weatherSummary.textContent = 'Configure API in Settings';
    return null;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const json = await res.json();
    const txt = `${Math.round(json.main.temp)}°C ${json.weather[0].main} (${json.name})`;
    weatherSummary.textContent = txt;
    weatherCard.innerHTML = `<div>${txt}</div>`;
    return json;
  } catch (err) {
    console.warn('weather error', err);
    weatherSummary.textContent = 'Weather error';
    return null;
  }
}

// ---------- Google Calendar (client-side)
let gapiInited = false;
let gIsSignedIn = false;
function initGapi(clientId) {
  if (!clientId) return;
  // load gapi auth2
  gapi.load('client:auth2', async () => {
    try {
      await gapi.client.init({
        apiKey: '', // not required for calendar list if using OAuth
        clientId: clientId,
        scope: 'profile email https://www.googleapis.com/auth/calendar.readonly'
      });
      gapiInited = true;
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    } catch (err) {
      console.error('gapi init error', err);
    }
  });
}
function updateSigninStatus(isSignedIn) {
  gIsSignedIn = isSignedIn;
  if (isSignedIn) {
    gcalSignInBtn.style.display = 'none';
    gcalSignOutBtn.style.display = 'inline-block';
    fetchTodayEvents();
  } else {
    gcalSignInBtn.style.display = 'inline-block';
    gcalSignOutBtn.style.display = 'none';
    eventsCard.innerHTML = '<p>Not signed in.</p>';
  }
}
gcalSignInBtn.addEventListener('click', async ()=>{
  if (!gapiInited) {
    const cid = localStorage.getItem(GCLIENT_KEY);
    if (!cid) return alert('Set Google Client ID in Settings first.');
    initGapi(cid);
    // wait a moment then sign in
    setTimeout(()=> gapi.auth2.getAuthInstance().signIn(), 500);
  } else {
    gapi.auth2.getAuthInstance().signIn();
  }
});
gcalSignOutBtn.addEventListener('click', ()=> {
  if (gapiInited) gapi.auth2.getAuthInstance().signOut();
});

async function fetchTodayEvents(){
  if (!gapiInited || !gIsSignedIn) return;
  try {
    await gapi.client.load('calendar', 'v3');
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(now); end.setHours(23,59,59,999);
    const resp = await gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': start.toISOString(),
      'timeMax': end.toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime'
    });
    const items = resp.result.items || [];
    // render
    const out = items.map(it => {
      const t = it.start.dateTime || it.start.date || '';
      const time = t ? (new Date(t)).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      return `<div class="card"><strong>${it.summary || '(no title)'}</strong><div class="small-muted">${time}</div></div>`;
    }).join('');
    eventsCard.innerHTML = out || '<p>No events today.</p>';
  } catch (err) {
    console.error('fetchTodayEvents', err);
    eventsCard.innerHTML = '<p>Calendar error. Check settings.</p>';
  }
}

function renderCalendarEvents(){ fetchTodayEvents(); }

// ---------- Prep Ahead: look at next meals and show prepNotes if any with lead time
async function renderPrepAhead(){
  const plan = await generateWeeklyPlanDays(7);
  const prepItems = [];
  // for each day beyond today, scan recipes for prepNotes
  plan.forEach(day => {
    for (const cat of Object.keys(day.meals)) {
      day.meals[cat].forEach(recipe => {
        if (recipe.prepNotes && recipe.prepNotes.trim()) {
          prepItems.push({
            date: day.date,
            meal: cat,
            title: recipe.title,
            note: recipe.prepNotes
          });
        }
      });
    }
  });
  // show only near-term items (today + tomorrow)
  const todayStr = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(); tomorrow.setDate(new Date().getDate()+1);
  const tStr = tomorrow.toISOString().slice(0,10);
  const filtered = prepItems.filter(p => p.date===todayStr || p.date===tStr);
  if (filtered.length === 0) {
    prepListEl.innerHTML = '<p>No prep needed in next 48 hours.</p>';
    return;
  }
  prepListEl.innerHTML = filtered.map(p => `<div class="card"><strong>${p.title} (${p.meal} - ${p.date})</strong><div class="small-muted">Prep: ${p.note}</div></div>`).join('');
}

// dashboard small cards
async function renderDashboard(){
  const data = await loadRecipes();
  const rotationDays = data.rotation_days || 4;
  const dayIndex = getRotationIndexForDate(new Date(), rotationDays);
  // pick meal for right now
  const now = new Date();
  const meal = mealPeriodByHour(now.getHours());
  const current = chooseRecipesForCategory(data.recipes[meal] || [], dayIndex);
  todayMealEl.innerHTML = current.map(r => `<div><strong>${r.title}</strong><div class="small-muted">${r.ingredients ? r.ingredients.length + ' ingredients' : ''}</div></div>`).join('');
  await fetchWeather();
  await renderPrepAhead();
  await fetchTodayEvents();
}

// ---------- Settings modal
settingsBtn.addEventListener('click', ()=>{
  remoteUrlInput.value = localStorage.getItem(REMOTE_URL_KEY) || '';
  owmKeyInput.value = localStorage.getItem(OWM_KEY) || '';
  owmCityInput.value = localStorage.getItem(OWM_CITY) || '';
  gclientInput.value = localStorage.getItem(GCLIENT_KEY) || '';
  settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', ()=> settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', ()=>{
  localStorage.setItem(REMOTE_URL_KEY, remoteUrlInput.value.trim());
  localStorage.setItem(OWM_KEY, owmKeyInput.value.trim());
  localStorage.setItem(OWM_CITY, owmCityInput.value.trim());
  localStorage.setItem(GCLIENT_KEY, gclientInput.value.trim());
  settingsModal.classList.add('hidden');
  alert('Settings saved. You may need to sign in to Google again if client ID changed.');
  // re-init gapi if client id present
  const cid = localStorage.getItem(GCLIENT_KEY);
  if (cid) initGapi(cid);
});

// ---------- Manual refresh button
refreshRecipesBtn.addEventListener('click', async ()=>{
  // force load using remote url if configured, else bundled
  const remote = localStorage.getItem(REMOTE_URL_KEY);
  let usedRemote = false;
  if (remote) {
    try {
      const r = await fetch(remote, {cache: 'no-store'});
      if (r.ok) {
        const json = await r.json();
        saveToStorage(LOCAL_RECIPES_KEY, json);
        usedRemote = true;
      }
    } catch(e){ console.warn(e); }
  }
  if (!usedRemote) {
    // fallback: fetch bundled and replace storage
    const b = await fetchBundled();
    saveToStorage(LOCAL_RECIPES_KEY, b);
  }
  await renderDashboard();
  alert('Recipes refreshed.');
});

// ---------- Init
(async function init(){
  // wire nav default
  showView('dashboard');
  // init gapi if client id already stored
  const cid = localStorage.getItem(GCLIENT_KEY);
  if (cid) initGapi(cid);
  // initial render
  await renderDashboard();
  // periodically refresh dashboard (every 10 minutes)
  setInterval(renderDashboard, 10*60*1000);
})();
