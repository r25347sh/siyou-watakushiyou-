document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const timeInput = document.getElementById('alarm-time');
    const status = document.getElementById('status');
    const overlay = document.getElementById('overlay');
    const fallbackVideo = document.getElementById('fallback-video');

    let wakeLock = null;
    let timeoutId = null;
    let isActive = false;

    // Wake Lock 要求（前回と同じ）
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            status.textContent = 'Wake Lock 非対応 → 動画フォールバック';
            startFallbackVideo();
            return;
        }
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            status.textContent = '画面保持中...';
        } catch (err) {
            console.error('Wake Lock 失敗:', err);
            startFallbackVideo();
        }
    }

    async function releaseWakeLock() {
        if (wakeLock) {
            await wakeLock.release().catch(() => {});
            wakeLock = null;
        }
        stopFallbackVideo();
    }

    function startFallbackVideo() {
        fallbackVideo.play().catch(() => {});
    }

    function stopFallbackVideo() {
        fallbackVideo.pause();
    }

    // 振動関数（パターン例: 短く複数回 → 起きやすい）
    function triggerVibration() {
        if ('vibrate' in navigator) {
            // パターン: 200ms振動 → 100ms休み → 200ms → 100ms → 400ms長め
            navigator.vibrate([200, 100, 200, 100, 400]);
            // 繰り返し（起きるまで数回）
            setTimeout(() => navigator.vibrate([200, 100, 200, 100, 400]), 1500);
            setTimeout(() => navigator.vibrate([300, 200, 300]), 3500);
        }
    }

    startBtn.addEventListener('click', async () => {
        if (isActive) return;

        const timeStr = timeInput.value;
        if (!timeStr) return alert('時間を設定してください');

        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        let alarm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        if (alarm <= now) alarm.setDate(alarm.getDate() + 1);

        const diffMs = alarm - now;

        document.body.classList.add('dark');
        document.body.classList.add('hidden-ui');
        status.textContent = '';

        await requestWakeLock();

        isActive = true;
        startBtn.disabled = true;
        cancelBtn.disabled = false;
        cancelBtn.style.display = 'block';

        timeoutId = setTimeout(() => {
            document.body.classList.remove('dark');
            document.body.classList.remove('hidden-ui');
            document.body.classList.add('alarm-active'); // アニメーション起動

            triggerVibration(); // 振動スタート

            releaseWakeLock();

            isActive = false;
            startBtn.disabled = false;
            cancelBtn.disabled = true;
            cancelBtn.style.display = 'none';

            // アニメ終了後クラス削除（繰り返さない）
            setTimeout(() => document.body.classList.remove('alarm-active'), 2000);

            // 起きやすいメッセージ（音なし）
            status.textContent = 'おはよう！起きてください！';
        }, diffMs);
    });

    cancelBtn.addEventListener('click', () => {
        if (timeoutId) clearTimeout(timeoutId);
        document.body.classList.remove('dark', 'hidden-ui', 'alarm-active');
        releaseWakeLock();
        status.textContent = 'キャンセルしました';
        isActive = false;
        startBtn.disabled = false;
        cancelBtn.disabled = true;
        cancelBtn.style.display = 'none';
    });

    // visibilitychange で Wake Lock 再取得
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isActive && !wakeLock) {
            requestWakeLock();
        }
    });
});
