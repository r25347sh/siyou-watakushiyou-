// 時計の更新（リアルタイム）
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
updateClock();  // 初回即表示
