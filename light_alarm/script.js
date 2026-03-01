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

    // Wake Lock を要求する関数
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            status.textContent = 'Wake Lock 非対応 → 動画フォールバック使用';
            startFallbackVideo();
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request('screen');
            status.textContent = 'Wake Lock 取得成功！画面が起き続けます';
            console.log('Screen Wake Lock アクティブ');

            // 自動リリースされた場合の再取得（visibilitychange で対応）
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock がリリースされました');
                wakeLock = null;
                if (isActive) {
                    // 再試行（ユーザー操作が必要な場合もある）
                    status.textContent = 'Wake Lock 失効 → 再取得試行中';
                    requestWakeLock();
                }
            });
        } catch (err) {
            console.error('Wake Lock 失敗:', err);
            status.textContent = 'Wake Lock 失敗 → 動画フォールバック使用';
            startFallbackVideo();
        }
    }

    // Wake Lock リリース
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

    // フォールバック: 隠し無音動画ループ
    function startFallbackVideo() {
        fallbackVideo.play().catch(e => {
            console.error('動画再生失敗:', e);
            status.textContent += '（動画も失敗。スリープ防止が弱まる可能性あり）';
        });
    }

    function stopFallbackVideo() {
        fallbackVideo.pause();
        fallbackVideo.currentTime = 0;
    }

    // 開始処理
    startBtn.addEventListener('click', async () => {
        if (isActive) return;

        const timeStr = timeInput.value;
        if (!timeStr) {
            alert('時間を設定してください');
            return;
        }

        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        let alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const diffMs = alarmTime - now;

        // 暗転開始
        document.body.classList.add('dark');
        status.textContent = '暗転中... アラームまで待機';

        // Wake Lock 要求（ユーザー操作直後なので許可されやすい）
        await requestWakeLock();

        isActive = true;
        startBtn.disabled = true;
        cancelBtn.disabled = false;

        // タイマー
        timeoutId = setTimeout(() => {
            // 明るく戻す
            document.body.classList.remove('dark');
            status.textContent = 'アラーム時間になりました！';
            releaseWakeLock();

            isActive = false;
            startBtn.disabled = false;
            cancelBtn.disabled = true;

            // 必要なら音や通知を追加可能
            alert('おはよう！アラームです');
        }, diffMs);
    });

    // キャンセル
    cancelBtn.addEventListener('click', () => {
        if (timeoutId) clearTimeout(timeoutId);
        document.body.classList.remove('dark');
        releaseWakeLock();
        status.textContent = 'キャンセルしました';
        isActive = false;
        startBtn.disabled = false;
        cancelBtn.disabled = true;
    });

    // ページ非表示時に Wake Lock がリリースされやすいので、復帰時に再取得を試みる
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isActive && !wakeLock) {
            requestWakeLock();
        }
    });
});
