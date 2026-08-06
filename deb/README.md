# ブラウザ上の deb 実行環境 (Drag & Drop 対応)

無料・完全クライアントサイドで Debian をブラウザ上に起動し、**ローカルの .deb ファイルをドラッグ＆ドロップしてインストール**できる環境です。

## 技術

- **CheerpX** (Leaning Technologies) — x86 → WebAssembly JIT（個人・FOSS 無料）
- 公式公開 Debian ディスクイメージ (CloudDevice + Overlay + IndexedDB)
- **DataDevice** で JS からバイナリを `/data` に書き込み

## 必須要件（ここで止まる場合のほぼすべて）

CheerpX は `SharedArrayBuffer` を必要とします。以下の HTTP ヘッダーが必須です。

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

- **GitHub Pages の生URL** ではヘッダーを付けられないため、起動が「Linux環境作成中...」で止まることが多いです。
- 対策:
  1. Cloudflare Pages にデプロイして `_headers` で上記を設定
  2. または公式 https://webvm.io を直接使う
  3. ローカルなら nginx / `npx serve` + ヘッダー設定、または `http-server` の適切なオプション

ページを開いたときに `SharedArrayBuffer 不可` や `crossOriginIsolated = false` と出たら、ヘッダー不足です。

## 使い方

1. 上記ヘッダー付きで `index.html` を配信する
2. ページを開く → ステータスが「準備完了」になるまで待つ（初回はディスクイメージの on-demand 取得で数分かかる場合あり）
3. 上の枠に **.deb ファイルをドラッグ＆ドロップ**
4. ターミナルに表示されたコマンドを実行:

```bash
cp /data/ファイル名.deb /tmp/
sudo dpkg -i /tmp/ファイル名.deb
sudo apt-get install -f -y
```

（DataDevice には実行ビットがないため、一度 `/tmp` など Overlay 上の場所にコピーしてから dpkg します）

## ネットワーク

外部からパッケージを取る場合は Tailscale（無料）の Exit Node が必要です。
詳細は WebVM の Networking ドキュメントを参照。

## 制限

- 32-bit x86 のみ
- 初回起動はディスクチャンクのダウンロードで時間がかかる
- CheerpX は個人・FOSS 無料。組織利用はライセンス確認を

## クレジット

- CheerpX / WebVM by [Leaning Technologies](https://leaningtech.com/)
- WebVM Apache-2.0 / CheerpX Community License（個人・FOSS 無料）

https://cheerpx.io/docs/  /  https://webvm.io
