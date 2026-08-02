# ROS Waypoint Tool

自律移動ロボット（ROS/ROS2 Navigation）向けの Waypoint（通過点）を作成・編集・管理するためのデスクトップアプリケーション。

<p align="center">
  <img src="./docs/images/main-app.png" alt="ROS Waypoint Tool Main Interface" width="800"/>
</p>

## 概要

ROS Waypoint Tool は、ロボットの経路設計を直感的な GUI で行えるデスクトップアプリケーションです。
Tauri をベースとした軽量な単一バイナリとして動作し、Windows および Linux をサポートしています。

### 主な特徴

- **直感的なキャンバス操作**: 矢印マーカーと Yaw 回転ハンドルによる視覚的な Waypoint 配置・編集。
- **高度なスナップ＆連続追加**: 直交スナップ・数値距離入力・矢印キーによる方向ロック・`Tab` キーによる基準点切替。
- **マルチマップレイヤー**: 複数の ROS Occupancy Grid Map（YAML + PGM/PNG）の重ね合わせ・不透明度調整。
- **動的カスタム属性（Option Schema）**: `string` / `float` / `integer` / `boolean` / `list` 型の Waypoint 属性を Settings から自由定義。
- **プラグイン拡張（Generators）**: Python / WASM による経路自動生成。キャンバス上のインタラクション入力・リアルタイムヒント描画・Generator Explode をサポート。
- **テンプレート出力**: Handlebars テンプレートによる YAML / JSON / CSV 等への柔軟なエクスポート。
- **高機能 UI**: カスタムタイトルバー・左右パネルの独立タブ＆上下分割・パネルリサイズ・`Ctrl+Z/Y` Undo/Redo・キーボードショートカット完備。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Backend | Rust / Tauri |
| Frontend | React / TypeScript / Vite / Tailwind CSS |
| Graphics | PixiJS (WebGL) |
| Plugin | Python / WASM |

---

## 開発環境のセットアップと起動

### 動作要件

- Node.js v18+
- Rust（latest stable）
- Linux の場合：`libwebkit2gtk-4.1-dev`、`build-essential` 等の Tauri 依存パッケージ

### ローカル開発起動

```bash
# 依存関係のインストール
npm install

# Vite 開発サーバーのみ起動（ブラウザで確認）
npm run dev

# Tauri デスクトップアプリとして起動（推奨）
npm run tauri dev
```

### Docker 開発環境

本プロジェクトには Tauri 開発に必要なすべての依存パッケージを含む Docker 開発環境が用意されています。
ホスト側に X Server（または Xvfb）が必要です。

```bash
# コンテナのビルドと起動（初回はイメージをビルドします）
make dev

# 起動済みコンテナ内のシェルに入る
make shell

# コンテナの停止
make down

# コンテナ・イメージ・ボリューム（キャッシュ含む）をすべて削除
make clean
```

---

## リリースビルド

```bash
# Web フロントエンドのバンドル生成のみ
npm run build

# Tauri デスクトップアプリ（バイナリ / インストーラ）のビルド
npm run tauri build
```

生成されたバイナリは `src-tauri/target/release/` 以下に配置されます。

---

## ドキュメント

- **[ユーザーガイド (USER_GUIDE.md)](./docs/USER_GUIDE.md)**: アプリの全機能の使い方と操作手順。
- **[プラグイン開発ガイド (PLUGIN_GUIDE.md)](./docs/PLUGIN_GUIDE.md)**: Python / WASM プラグインの作成方法。
- **[開発者ガイド (DEVELOPMENT_GUIDE.md)](./docs/DEVELOPMENT_GUIDE.md)**: 開発手順・アーキテクチャ・テスト指針。
