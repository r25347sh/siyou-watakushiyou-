document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-alarm');
    const timeInput = document.getElementById('alarm-time');
    const silentAudio = document.getElementById('silent-audio');
    const body = document.body;

    startButton.addEventListener('click', () => {
        const alarmTime = timeInput.value;
        if (!alarmTime) {
            alert('時間を設定してください');
            return;
        }

        const [hours, minutes] = alarmTime.split(':').map(Number);
        const now = new Date();
        const alarm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        if (alarm < now) {
            alarm.setDate(alarm.getDate() + 1);
        }

        const timeDiff = alarm - now;

        // 画面を暗転
        body.classList.add('dark-mode');

        // 無音オーディオをループ再生（スリープ防止）
        silentAudio.play().catch(error => {
            console.error('オーディオ再生エラー:', error);
        });

        // タイマーセット
        setTimeout(() => {
            // 画面を明るく
            body.classList.remove('dark-mode');
            body.classList.add('bright-mode');
            // オーディオ停止（任意）
            silentAudio.pause();
        }, timeDiff);
    });
});
