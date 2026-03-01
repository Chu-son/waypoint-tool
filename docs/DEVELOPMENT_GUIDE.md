# 開発者ガイド (Development Guide)

本ドキュメントは、ROS Waypoint Tool のコア開発に携わる開発者およびコントリビューター向けのリファレンスです。

## 1. 開発環境のセットアップ

### 前提条件
- Node.js v18+
- Rust (latest stable)
- Linux の場合: `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev` 等の Tauri 依存パッケージ。

### セットアップ手順
```bash
git clone <repository-url>
cd waypoint-tool
npm install
```

### 起動
```bash
# Vite + Tauri 開発サーバーの起動
npm run tauri dev
```

## 2. アーキテクチャ

本ツールは「疎結合な設計」を重視しています。

- **Frontend (Tauri WebView)**: 
  - React + TypeScript
  - 状態管理: **Zustand** (`src/stores/appStore.ts`)
  - 描画エンジン: **PixiJS** (`src/components/canvas/MapCanvas.tsx`)
  - スタイル: **Tailwind CSS v4**
- **Backend (Rust Core)**:
  - ファイル I/O, OS 連携, プラグイン実行。
  - フロントエンドとは Tauri の IPC (Command) で通信。

## 3. 命名規則 (Naming Conventions)

一貫性を保つため、以下の規則を厳守してください。

- **Frontend (`src/`)**:
  - React コンポーネント: `PascalCase` (例: `MapCanvas.tsx`)
  - Hooks / Stores / Utils: `camelCase` (例: `appStore.ts`)
  - 共通 UI クラス: `ui-` プレフィックス (例: `ui-btn-primary`)
- **Backend (`src-tauri/`)**:
  - Rust ファイル・変数・関数: `snake_case` (Rust 標準)

## 4. テスト指針 (Testing)

### フロントエンド (Vitest)
ロジックやコンポーネントの振る舞いをテストします。
```bash
npm run test
```
- `*.test.ts` / `*.test.tsx` を同じディレクトリに作成。

### バックエンド (Rust)
```bash
cd src-tauri
cargo test
```
- 各モジュールの末尾にある `#[cfg(test)]` ブロックに記述。

### Python SDK
```bash
cd python_sdk
python3 -m unittest discover tests
```

## 5. コントリビュートの流れ
1. Issue を確認、または作成する。
2. `feature/` または `fix/` ブロックでブランチを作成。
3. 命名規則とテスト指針に従って実装。
4. プルリクエストを作成し、レビューを受ける。
