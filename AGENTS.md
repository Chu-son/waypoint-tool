# AIエージェント向けガイドライン (AGENTS & AI Assistants)

このファイルは、本プロジェクトにおいてAIエージェント（Antigravity、Cursor、Windsurf、GitHub Copilot等）が自律的または支援的にコーディングを行うためのプロンプト・コンテキストファイルです。
AIとして本プロジェクトのコードを変更・提案する際は、**必ずこのガイドラインを起点として振る舞いを決定してください。**

## 1. System Overview (システムアーキテクチャの前提)

本プロジェクトのコアとなるドメイン・技術スタックは以下の通りです。AIによるコード変更は、このアーキテクチャの原則に沿う必要があります。

- **Frontend**: Tauri WebView 内で動作する React + TypeScript
  - 状態管理: **Zustand** (`src/stores/appStore.ts`) に集約し、Prop Drilling を避けること。
  - 描画エンジン: **PixiJS** (`src/components/canvas/MapCanvas.tsx`)。UI (React) と描画 (PixiJS) の疎結合を保つこと。
- **Backend**: Tauri (Rust)
- **Plugin System**: 外部プロセス（Python/WASM等）と標準入出力 (JSON) 経由で通信する。

## 2. Documentation Index & AI Instructions (必須のドキュメント参照)

**ドキュメントの重複・保守コスト増加を防ぐため、本ファイルには具体的なルールを記載していません。**
AIエージェントは、これから実行するタスクの内容に応じて、**実装案を提示したりコードを修正する前に、必ず対象となる以下のドキュメントを自身のツール（`read_file` 等）で読み込んでください。**

- 📖 **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**
  - **いつ読むか**: 新規モジュールやレイヤーを追加・変更する時、モジュール間のデータフローやシステム構成を確認する時。
  - **目的**: 全体ディレクトリツリー構造、Zustand スライス構造、データ連携仕様の確認。
- 📖 **[docs/COMPONENT_CATALOG.md](./docs/COMPONENT_CATALOG.md)**
  - **いつ読むか**: UIコンポーネントや Canvas レヤーを再利用・追加・修正する時。既存コンポーネントの Props や役割を調べる時。
  - **目的**: UI部品、パネル、モーダル、PixiJS レイヤー、主要ストア・ユーティリティの一覧と使用方法の確認。
- 📖 **[docs/RULES.md](./docs/RULES.md)**
  - **いつ読むか**: UIコンポーネントを追加・修正する時。**キーボードショートカットを追加・変更する時**。
  - **目的**: ディレクトリ分割ルールの確認。ショートカット変更時にHelp（Shortcut一覧）を追従更新する義務の確認。
- 📖 **[docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)**
  - **いつ読むか**: 開発環境のセットアップやテスト実行を行う時、命名規則を確認する時。
  - **目的**: 命名規則（CamelCase vs PascalCase, Rustのsnake_case等）やテスト方針の確認。
- 📖 **[docs/PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md)**
  - **いつ読むか**: ジェネレーター機能（Pythonプラグイン）の修正や追加を行う時。インタラクションヒントを触る時。
  - **目的**: プラグインと本体の通信仕様（JSON）、`manifest.json` の構造、Python SDKの使い方の確認。
- 📖 **[docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)**
  - **いつ読むか**: 機能の全体的な要件や仕様の意図を確認したい時。
- 📖 **[docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)**
  - **いつ読むか**: UIコンポーネントを新規追加・修正・リファクタリングする時。スタイリング方針を確認する時。
  - **目的**: コンポーネント設計方針、デザイントークン使用ガイド、Raw Tailwindカラー禁止ルールの確認。

## 3. 開発時のスタンス

- 常に「Single Source of Truth」を意識し、状態管理は `appStore.ts` を正として扱ってください。
- ドキュメントの内容に違反する提案はしないでください。分からないことがあれば、推測する前に該当するドキュメントを検索・参照してください。
