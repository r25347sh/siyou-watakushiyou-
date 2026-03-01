document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const timeInput = document.getElementById('alarm-time');
    const status = document.getElementById('status');
    const fallbackVideo = document.getElementById('fallback-video');

    let wakeLock = null;
    let timeoutId = null;
    let isActive = false;

    // Wake Lock 要求
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            status.textContent = 'Wake Lock 非対応 → 動画フォールバック使用';
            startFallbackVideo();
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock アクティブ');
        } catch (err) {
            console.error('Wake Lock 失敗:', err);
            startFallbackVideo();
        }
    }

    async function releaseWakeLock() {
        if (wakeLock) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Wake Lock リリース');
            } catch (err) {
                console.error('リリース失敗:', err);
            }
        }
        stopFallbackVideo();
    }

    function startFallbackVideo() {
        fallbackVideo.play().catch(e => console.error('動画再生失敗:', e));
    }

    function stopFallbackVideo() {
        fallbackVideo.pause();
        fallbackVideo.currentTime = 0;
    }

    // 振動関数（起きやすいパターン）
    function triggerVibration() {
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 400]);
            setTimeout(() => navigator.vibrate([200, 100, 200, 100, 400]), 1500);
            setTimeout(() => navigator.vibrate([300, 200, 300]), 3500);
        }
    }

    startBtn.addEventListener('click', async () => {
        if (isActive) return;

        const timeStr = timeInput.value;
        if (!timeStr) {
            status.textContent = '時間を設定してください';
            return;
        }

        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        let alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const diffMs = alarmTime - now;

        // 暗転 + UI隠す
        document.body.classList.add('dark');
        document.body.classList.add('hidden-ui');
        status.textContent = '';

        // Wake Lock 要求
        await requestWakeLock();

        isActive = true;
        startBtn.disabled = true;
        cancelBtn.disabled = false;
        cancelBtn.style.display = 'block';

        timeoutId = setTimeout(() => {
            // 明るく戻す + アニメーション + 振動
            document.body.classList.remove('dark');
            document.body.classList.remove('hidden-ui');
            document.body.classList.add('alarm-active');

            triggerVibration();

            releaseWakeLock();

            isActive = false;
            startBtn.disabled = false;
            cancelBtn.disabled = true;
            cancelBtn.style.display = 'none';

            // アニメ終了後にクラス削除
            setTimeout(() => {
                document.body.classList.remove('alarm-active');
            }, 2000);

            // ステータスだけ軽く表示（音・通知なし）
            status.textContent = '時間になりました';
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

    // ページ復帰時に Wake Lock 再取得を試みる
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isActive && !wakeLock) {
            requestWakeLock();
        }
    });
});
