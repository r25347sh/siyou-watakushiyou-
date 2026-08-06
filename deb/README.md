# ブラウザ上の deb 実行環境 (Browser Debian / .deb runner)

無料・完全クライアントサイドで Debian 環境をブラウザ上に起動し、`.deb` パッケージを実行・インストールできる環境です。

## 技術

- **CheerpX** (Leaning Technologies): x86 → WebAssembly JIT。個人・FOSS 利用無料。
- 公式公開 Debian ディスクイメージ (CloudDevice)
- 変更はブラウザの IndexedDB に永続化

## 使い方

1. このリポジトリを GitHub Pages で公開するか、ローカルで `python3 -m http.server` などで配信（**重要**: SharedArrayBuffer 用に以下のヘッダーが必要）

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

GitHub Pages の場合は Actions や `_headers` / Cloudflare などで設定してください。

2. `index.html` を開く
3. ターミナルが起動したら以下で `.deb` を扱えます

### .deb のインストール例

```bash
# ネットワークがある場合（Tailscale Exit Node 推奨）
curl -LO https://example.com/your-package.deb
sudo dpkg -i your-package.deb
# 依存関係
sudo apt-get install -f

# またはローカルに置いた .deb を /data 経由で使う場合は別途 DataDevice を拡張
```

ネットワークが使えない場合は、WebVM 公式 (https://webvm.io) を直接使うか、Tailscale を接続してください。

## 制限

- 現状 32-bit x86 のみ
- 完全なネットワークには Tailscale が必要（無料アカウント可）
- CheerpX は個人/FOSS 無料。商用組織利用はライセンス確認を

## クレジット

- CheerpX / WebVM by [Leaning Technologies](https://leaningtech.com/)
- ライセンス: WebVM 部分 Apache-2.0、CheerpX は Community License（個人・FOSS 無料）

詳細: https://cheerpx.io/docs/  / https://webvm.io
