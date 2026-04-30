// ── 時計 ──
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('clock').textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// ── 経過日数（2026/01/23起点、当日を0日目） ──
/*const startDate = new Date('2026-01-23');
function updateDaysPassed() {
  const diffTime = new Date() - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  document.getElementById('days').textContent = `+ [${diffDays}日目]`;
}
updateDaysPassed();*/

// ── テーマ切替（システム優先 + 手動 + 保存） ──
const toggleBtn = document.getElementById('theme-toggle');
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme');

if (savedTheme) {
  html.setAttribute('data-theme', savedTheme);
  toggleBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = prefersDark ? 'dark' : 'light';
  html.setAttribute('data-theme', initial);
  toggleBtn.textContent = prefersDark ? '🌙' : '☀️';
}

toggleBtn.addEventListener('click', () => {
  const current = html.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  toggleBtn.textContent = next === 'light' ? '☀️' : '🌙';
});

// ── 天気（Open-Meteo + Geolocation fallback to Kashiwa） ──
async function fetchWeather() {
  const weatherDiv = document.getElementById('weather');
  let lat = 35.8683, lon = 139.9247;

  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch (err) {
    console.log('位置情報失敗 → 柏市固定', err);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,pressure_msl` +
                `&timezone=Asia%2FTokyo`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('APIレスポンスエラー');
    const data = await res.json();
    const c = data.current;

    function getWindDir(deg) {
      const dirs = ['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'];
      return dirs[Math.round(deg / 22.5) % 16];
    }

    let cond = '不明';
    const code = c.weather_code;
    if (code === 0) cond = '晴れ';
    else if (code <= 3) cond = '晴れ/曇り';
    else if ([45,48].includes(code)) cond = '霧';
    else if (code >= 51 && code <= 67) cond = '雨/小雨/みぞれ';
    else if (code >= 71 && code <= 86) cond = '雪/雨雪混じり';
    else if (code >= 95) cond = '雷雨';

    weatherDiv.innerHTML = `
      <div class="current-temp">${Math.round(c.temperature_2m)}°C</div>
      <div class="current-condition">${cond}</div>
      <div class="feels-like">体感 ${Math.round(c.apparent_temperature)}°C</div>
      <div class="details-grid">
        <div>湿度: ${c.relative_humidity_2m}%</div>
        <div>風: ${Math.round(c.wind_speed_10m)} m/s (${getWindDir(c.wind_direction_10m)})</div>
        <div>雲量: ${c.cloud_cover}%</div>
        <div>気圧: ${Math.round(c.pressure_msl)} hPa</div>
        ${c.precipitation > 0 ? `<div>降水: ${c.precipitation.toFixed(1)} mm/h</div>` : ''}
      </div>
    `;
  } catch (err) {
    console.error('天気エラー', err);
    weatherDiv.innerHTML = '<div class="weather-loading">天気: 取得できませんでした</div>';
  }
}

// ── 検索エンジン切り替え ──
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const engines = {
  'Google': 'https://www.google.com/search',
  'DuckDuckGo': 'https://duckduckgo.com/',
  'Yahoo! Japan': 'https://search.yahoo.co.jp/search',
  'Ask.com': 'https://www.ask.com/web'
};

const savedEngine = localStorage.getItem('preferredEngine') || 'Google';
if (savedEngine in engines) {
  searchForm.action = engines[savedEngine];
  searchInput.placeholder = `検索 (${savedEngine})`;
}

searchInput.addEventListener('input', () => {
  const val = searchInput.value.trim().toLowerCase();
  for (const [name, url] of Object.entries(engines)) {
    if (val === name.toLowerCase()) {
      searchForm.action = url;
      localStorage.setItem('preferredEngine', name);
      searchInput.placeholder = `検索 (${name})`;
      break;
    }
  }
});

searchForm.addEventListener('submit', e => {
  if (!searchInput.value.trim()) e.preventDefault();
});

// ── 新機能 ──

// 1. 壁紙変更（Unsplash + 保存）
function setRandomBackground() {
  const timestamp = Date.now();
  const url = `https://picsum.photos/1920/1080?random=${timestamp}`;  // シンプルで確実なランダム画像

  document.body.style.backgroundImage = `url(${url})`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';

  localStorage.setItem('customBg', url);

  console.log('壁紙セット試行:', url);  // F12コンソールで確認用
}

// ロード時復元（これもpicsum対応）
const saved = localStorage.getItem('customBg');
if (saved) {
  document.body.style.backgroundImage = `url(${saved})`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
}

const btn = document.getElementById('bg-change');
if (btn) {
  btn.addEventListener('click', setRandomBackground);
} else {
  console.warn('ボタンID "bg-change" が見つかりません');
}
// 2. 今日の名言
async function fetchQuote() {
  try {
    const res = await fetch('https://zenquotes.io/api/random');
    const [data] = await res.json();
    const quoteEl = document.createElement('p');
    quoteEl.id = 'quote';
    quoteEl.innerHTML = `「${data.q}」<br>— ${data.a}`;
    document.querySelector('main')?.appendChild(quoteEl);
  } catch {}
}
fetchQuote();

// 3. マウス追従エフェクト
const cursor = document.createElement('div');
cursor.id = 'cursor-dot';
document.body.appendChild(cursor);

document.addEventListener('mousemove', e => {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
});

// 4. ToDoリスト
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
if (todoInput && todoList) {
  let todos = JSON.parse(localStorage.getItem('todos') || '[]');

  function render() {
    todoList.innerHTML = '';
    todos.forEach((text, i) => {
      const li = document.createElement('li');
      li.textContent = text;
      const del = document.createElement('button');
      del.textContent = '×';
      del.onclick = () => { todos.splice(i, 1); save(); render(); };
      li.append(del);
      todoList.append(li);
    });
  }

  function save() { localStorage.setItem('todos', JSON.stringify(todos)); }

  todoInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      todos.push(e.target.value.trim());
      e.target.value = '';
      save();
      render();
    }
  });

  render();
}

// 5. ショートカット: Tキー でテーマ切替
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 't' && !e.target.matches('input, textarea')) {
    toggleBtn.click();
  }
});

// ── 初期実行 ──
fetchWeather();  // 最後に天気（重めなので）
