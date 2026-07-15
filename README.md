# ROS Waypoint Tool

自律移動ロボット（ROS/ROS2 Navigation）向けの Waypoint（通過点）を作成・編集・管理するためのデスクトップアプリケーション。

## 概要

ROS Waypoint Tool は、ロボットの経路設計を直感的な GUI で行えるスタンドアロンツールです。Tauri をベースとした軽量な単一バイナリとして動作し、Windows および Linux をサポートしています。

### 主な特徴

- **直感的な操作**: マウス操作による Waypoint の配置、回転、移動。
- **マルチマップ対応**: 複数の ROS 標準 Occupancy Grid Map (YAML + PGM/PNG) を重ねて表示。
- **柔軟なカスタマイズ**: waypoint ごとに「目標速度」や「停止時間」などのカスタム属性を動的に定義可能。
- **プラグイン拡張**: Python や WASM を用いた独自の経路自動生成アルゴリズム（ジェネレーター）を容易に追加。
- **テンプレート出力**: Handlebars を用いて、ロボットの仕様に合わせた自由なフォーマットでエクスポート可能。

## 技術スタック

- **Backend**: Rust / Tauri
- **Frontend**: React / TypeScript / Vite / Tailwind CSS
- **Graphics**: PixiJS (WebGL) / React-Pixi-Fiber

## クイックスタート

### 動作要件

- Node.js (v18+)
- Rust (latest stable)
- (Linux の場合) Tauri の依存パッケージ (`libwebkit2gtk-4.1-dev` 等)

### 開発用サーバーの起動

```bash
# 依存関係のインストール
npm install

# 開発用アプリの起動
npm run tauri dev
```

## ドキュメント

より詳細な情報は、以下のドキュメントを参照してください。

- **[要件定義 (REQUIREMENTS.md)](./docs/REQUIREMENTS.md)**: ツールの全貌と機能仕様。
- **[ユーザーガイド (USER_GUIDE.md)](./docs/USER_GUIDE.md)**: アプリの具体的な使い方、設定、エクスポート手順。
- **[プラグイン開発ガイド (PLUGIN_GUIDE.md)](./docs/PLUGIN_GUIDE.md)**: 独自の自動生成プラグインを作成する方法。
- **[開発者ガイド (DEVELOPMENT_GUIDE.md)](./docs/DEVELOPMENT_GUIDE.md)**: コアアプリへのコントリビュート、アーキテクチャ、テスト指針。
