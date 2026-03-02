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
  let lat = 35.8683; // 柏市の緯度 (fallback)
  let lon = 139.9247; // 柏市の経度

  try {
    // Geolocationで現在地取得（許可が必要）
    const position = await new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      } else {
        reject(new Error('Geolocation not supported'));
      }
    });
    lat = position.coords.latitude;
    lon = position.coords.longitude;
  } catch (err) {
    console.log('位置情報取得失敗 → 柏市を使用', err);
    // fallbackは柏市そのまま
  }

  try {
    // Open-Meteo API (無料・キー不要)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`;
    const res = await fetch(url);
    const data = await res.json();

    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;

    // WMOコード簡易マップ（https://open-meteo.com/en/docs 参照）
    let condition = '不明';
    if (code === 0) condition = '晴れ';
    else if (code <= 3) condition = '晴れ/曇り';
    else if (code <= 48) condition = '曇り';
    else if (code <= 67 || code === 80 || code === 81) condition = '雨';
    else if (code <= 86) condition = '雪/雨雪混じり';
    else condition = '雷/嵐';

    weatherDiv.textContent = `現在: ${condition}, ${temp}°C`;
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
