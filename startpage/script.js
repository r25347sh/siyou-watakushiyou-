// 時計
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

// 経過日数（2026/01/23起点）
const startDate = new Date('2026-01-23');
function updateDaysPassed() {
  const today = new Date();
  const diffTime = today - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); //当日を0日カウント
  document.getElementById('days').textContent = `+ [${diffDays}日目]`;
}
updateDaysPassed();

// テーマ切替（システム優先 + 手動上書き）
const toggleBtn = document.getElementById('theme-toggle');
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme');

if (savedTheme) {
  html.setAttribute('data-theme', savedTheme);
  toggleBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
} else {
  // システムデフォルトを明示的に設定
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = prefersDark ? 'dark' : 'light';
  html.setAttribute('data-theme', initialTheme);
  toggleBtn.textContent = prefersDark ? '🌙' : '☀️';
}

toggleBtn.addEventListener('click', () => {
  const current = html.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  toggleBtn.textContent = next === 'light' ? '☀️' : '🌙';
});
// 天気（Open-Meteo API + Geolocation fallback to Kashiwa）
async function fetchWeather() {
  const weatherDiv = document.getElementById('weather');
  let lat = 35.8683;
  let lon = 139.9247;

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
    });
    lat = position.coords.latitude;
    lon = position.coords.longitude;
  } catch (err) {
    console.log('位置情報取得失敗 → 柏市を使用', err);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,pressure_msl` +
                `&timezone=Asia%2FTokyo`;

    const res = await fetch(url);
    const data = await res.json();

    const current = data.current;

    // 風向きを方角に変換するヘルパー
    function getWindDirection(deg) {
      const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
                    '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
      return dirs[Math.round(deg / 22.5) % 16];
    }

    // WMOコード → 日本語の天気表現（もっと細かくしたいならここを充実）
    let condition = '不明';
    const code = current.weather_code;
    if (code === 0) condition = '晴れ';
    else if (code <= 3) condition = '晴れ/曇り';
    else if (code === 45 || code === 48) condition = '霧';
    else if (code >= 51 && code <= 67) condition = '雨/小雨/みぞれ';
    else if (code >= 71 && code <= 86) condition = '雪/雨雪混じり';
    else if (code >= 95) condition = '雷雨/雷を伴う雨';

    // HTMLを詳細に
    let html = `
      <div style="font-size:1.4em; font-weight:bold;">${Math.round(current.temperature_2m)}°C</div>
      <div style="font-size:0.9em; opacity:0.9;">体感 ${Math.round(current.apparent_temperature)}°C</div>
      <div>${condition}</div>
      <div style="margin-top:8px; font-size:0.85em; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <div>湿度: ${current.relative_humidity_2m}%</div>
        <div>風: ${Math.round(current.wind_speed_10m)} m/s (${getWindDirection(current.wind_direction_10m)})</div>
        <div>雲量: ${current.cloud_cover}%</div>
        <div>気圧: ${Math.round(current.pressure_msl)} hPa</div>
        ${current.precipitation > 0 ? `<div>降水: ${current.precipitation.toFixed(1)} mm/h</div>` : ''}
      </div>
    `;

    weatherDiv.innerHTML = html;

  } catch (err) {
    console.error('天気取得エラー', err);
    weatherDiv.textContent = '天気: 取得できませんでした';
  }
}

// 検索エンジン切り替え
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

// エンジンごとの検索URLマップ
const engines = {
  'Google': 'https://www.google.com/search',
  'DuckDuckGo': 'https://duckduckgo.com/',
  'Yahoo! Japan': 'https://search.yahoo.co.jp/search',
  'Ask.com': 'https://www.ask.com/web'
};

// ページ読み込み時に保存されたエンジンを復元
const savedEngine = localStorage.getItem('preferredEngine') || 'Google';
if (savedEngine in engines) {
  searchForm.action = engines[savedEngine];
  // 入力欄に初期表示（任意でおしゃれに）
  searchInput.placeholder = `検索 (${savedEngine})`;
}

// 入力変更時にエンジン検知 & action変更
searchInput.addEventListener('input', () => {
  const value = searchInput.value.trim();
  
  // 入力値がエンジン名と完全に一致したら切り替え
  for (const [name, url] of Object.entries(engines)) {
    if (value.toLowerCase() === name.toLowerCase()) {
      searchForm.action = url;
      localStorage.setItem('preferredEngine', name);
      // 入力欄をクリアして検索しやすく（任意）
      // searchInput.value = '';
      searchInput.placeholder = `検索 (${name})`;
      break;
    }
  }
});

// フォーム送信前に最終確認（Enter押した時など）
searchForm.addEventListener('submit', (e) => {
  const query = searchInput.value.trim();
  if (!query) {
    e.preventDefault();
    return;
  }
  
  // 現在のactionで送信（すでにJSでセット済み）
});

fetchWeather(); // ページ読み込み時に実行
