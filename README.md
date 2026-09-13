# ROS Waypoint Tool

自律移動ロボット（ROS / ROS2 Navigation / Nav2）向けの Waypoint（通過点・姿勢・属性）を作成・編集・管理するための次世代統合デスクトップオーサリングツール。

<p align="center">
  <img src="./docs/images/main-app.png" alt="ROS Waypoint Tool Main Interface" width="800"/>
</p>

## 概要

**ROS Waypoint Tool** は、ロボットの経路設計・現場オーサリングを直感的な GUI で行えるプロフェッショナル向けデスクトップアプリケーションです。
Tauri (Rust) と React / PixiJS (WebGL) をベースとした軽量・高速な単一バイナリとして動作し、Linux および Windows をフルサポートしています。

単なる Waypoint 配置にとどまらず、実寸ロボットフットプリントの可視化、ベクター関心領域（アノテーション）、ラスター占有地図の手動加筆、障害物回避パスの自動計算、Python による経路自動生成プラグイン＆パイプライン、そして現場オペレーター向けのホワイトラベル化・ワークフロー UI までを包括的に提供します。

---

## 主な特徴

### 1. 直感的なキャンバス操作 & 精密スナップ
- **矢印マーカー & 回転ハンドル**: クリックでの地点追加と、Yaw 回転ハンドルによる姿勢角の直感的な調整（Quaternion 相互自動変換）。
- **高度な直交スナップ & 数値入力**: X/Y 軸への自動スナップ、テンキーによる実寸距離（メートル）直接入力、矢印キーによる方向強制ロック、`Tab` キーによる基準点切替。
- **階層ツリー管理**: ノードのグループ化、ドラッグ＆ドロップ並び替え（不連続ノードの一括ドラッグ・連続化配置）、新規追加先を示す「挿入バー」。
- **アンカー相対座標 & 属性の連続コピー**: 基準アンカーノードからの相対距離・相対角度表示、および Transform の数値を別ノードへワンクリックで次々に適用する `ElementCopyOverlay`。

### 2. アノテーション (Vector ROI) & カスタムレイヤー (Raster Occupancy)
- **ベクターアノテーション**: 進入禁止エリア、仮想壁、走行推奨レーンなどを 5 つの幾何図形（Point, OrientedPoint, Line, Rect, Circle）で自在に描画・変形。
- **ラスターカスタムレイヤー**: 直線・矩形・円形・フリーハンドブラシにより、占有格子地図上に障害物（黒）や走行可能エリア（白）をピクセル加筆。
- **マルチレイヤーブレンド**: 複数レイヤーの重ね合わせ順序、透過度、3 つのブレンドモード（Overwrite, Merge Obstacles, Merge Free）、および Rust 並列処理によるリアルタイム合成プレビュー。

### 3. ロボットフットプリント & パスルーティング
- **Nav2 準拠フットプリント**: 円形・矩形・多角形の寸法定義とリアルタイム SVG プレビュー。キャンバス上での実寸外枠・進行方向表示。
- **パスルーティング & コリドー帯**: 直線補間に加え、組み込み Dijkstra プラグインによる障害物回避パスの自動計算。ロボット幅と連動した実寸通過帯（コリドー）の描画。
- **実寸計測ツール (Measure)**: キャンバス上の 2 点間・オブジェクト間の実寸距離をリアルタイム計測し、寸法線アノテーションとして保存。

### 4. プラグイン拡張 & パイプラインシステム (Python / WASM)
- **統合ジェネレーター**: Python / WASM スクリプトと標準入出力 (JSON) で通信。Waypoint・カスタムレイヤー・アノテーション・計算メタデータを 1 回の実行で複合生成。
- **Diff & Stash 競合管理**: 自動生成後に手動微調整したノードの差分を保持したまま、新しいパラメータで再生成（Regenerate）可能。
- **パイプラインレシピ**: 複数プラグインの実行ステップを連鎖させ、前段の出力を後段の入力へバインドする自動処理パイプライン。
- **Python venv 自動構築**: プラグイン実行用の仮想環境作成と依存 pip パッケージのインストールを GUI からワンクリック実行。

### 5. 条件付き書式 & カスタム属性
- **動的 Option Schema**: `string`, `float`, `integer`, `boolean`, `list` 型のカスタム属性をプロジェクトごとに定義し、Inspector に入力フォームを自動生成。
- **条件付き書式 (Conditional Styles)**: 属性値（速度、モード、ノード名等）に応じて、Waypoint・パス・フットプリント・アノテーションの色、線幅、破線、マーカー形状を動的にカスケード変更。

### 6. 入出力 & 一括エクスポートプロファイル
- **完全内包プロジェクトファイル (`.wptroj`)**: マップ画像からノード、設定まで全データを単一ファイルに完全保存・透過復元。
- **Handlebars 自由テンプレート**: YAML, JSON, CSV, XML 等へ柔軟に出力。テンプレートからインポートマッピングを自動推論。
- **一括エクスポートプロファイル**: 複数成果物（ウェイポイント、マップ画像等）を 1 つのプロファイルにまとめ、衝突検知・自動バックアップ付きでワンクリック一括生成。
- **マップ切り出しエクスポート**: 任意領域のマップ画像を最適解像度でラスタライズ出力。

### 7. Custom UI (ホワイトラベル & ワークフロー)
- **外部設定ファイル (`custom-ui.config.json`)**: アプリ名、ロゴ、テーマカラー、左右パネル構成、ツールバー表示を外部 JSON 1 つで専用ツール化。
- **ワークフローガイド**: 初心者・現場オペレーター向けに、ステップバイステップの作業手順と簡易コントロールを案内。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| **Backend** | Rust / Tauri Core |
| **Frontend** | React 18 / TypeScript / Vite / Tailwind CSS |
| **Graphics Engine** | PixiJS (WebGL) / GPU GLSL Custom Shaders |
| **State Management** | Zustand (11 Slices Architecture / Anti-Corruption Layer) |
| **Plugin / Scripting** | Python 3 (with `wpt_plugin` SDK) / WebAssembly (WASM) |
| **Template Engine** | Handlebars (YAML / JSON / CSV Export) |

---

## 開発環境のセットアップと起動

### 動作要件
- Node.js v18+
- Rust（latest stable）
- Linux の場合: `libwebkit2gtk-4.1-dev`, `build-essential` 等の Tauri 依存パッケージ

### ローカル開発起動
```bash
# 依存関係のインストール
npm install

# Vite 開発サーバーのみ起動（ブラウザ確認）
npm run dev

# Tauri デスクトップアプリとして起動（推奨）
npm run tauri dev
```

### Docker 開発環境
本リポジトリには、Tauri 開発に必要なすべてのシステム依存を含む Docker 開発環境が同梱されています（ホスト側に X Server または Xvfb が必要です）。
```bash
# コンテナのビルドと起動
make dev

# コンテナ内のシェルに入る
make shell

# コンテナの停止
make down

# コンテナ・ボリュームの完全削除
make clean
```

---

## リリースビルド

```bash
# Web フロントエンドのバンドル生成のみ
npm run build

# Tauri デスクトップアプリ（ネイティブバイナリ / インストーラ）のビルド
npm run tauri build
```
生成されたバイナリ（deb, AppImage, exe, msi 等）は `src-tauri/target/release/` 以下に配置されます。

---

## ドキュメント一覧

本プロジェクトの包括的な仕様・ガイドラインは `docs/` ディレクトリに整理されています：

| ドキュメント | 内容 |
|---|---|
| 📖 **[REQUIREMENTS.md](./docs/REQUIREMENTS.md)** | **【システム要件定義書】** 全機能要件、システム不変条件、アーキテクチャ原則、非機能要件の公式仕様書。 |
| 📖 **[USER_GUIDE.md](./docs/USER_GUIDE.md)** | **【ユーザーガイド】** アプリの全機能の使い方、チュートリアル、ショートカット一覧、FAQ。 |
| 📖 **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | **【システムアーキテクチャ】** ディレクトリ構造、Zustand スライス構成、データフロー、不変条件。 |
| 📖 **[STATE_MACHINE.md](./docs/STATE_MACHINE.md)** | **【状態機械・対話仕様書】** 5つの直交軸、8つのプライマリモード、階層型エスケープ、選択権限仕様。 |
| 📖 **[COMPONENT_CATALOG.md](./docs/COMPONENT_CATALOG.md)** | **【コンポーネントカタログ】** UI 部品、PixiJS レイヤー、主要フック・ユーティリティの一覧と使用法。 |
| 📖 **[CUSTOM_UI_GUIDE.md](./docs/CUSTOM_UI_GUIDE.md)** | **【Custom UI ガイド】** 専用ツール化・ホワイトラベル化・ワークフロー設定の仕様書。 |
| 📖 **[PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md)** | **【プラグイン開発ガイド】** Python / WASM プラグインの通信仕様、マニフェスト、Python SDK の使い方。 |
| 📖 **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** | **【開発者ガイド】** 開発環境構築、命名規則、テスト方針。 |
| 📖 **[RULES.md](./docs/RULES.md)** | **【開発ルール】** ショートカット管理規約（Help同期義務）、後方互換性ルール。 |
| 📖 **[DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** | **【デザインシステム】** デザイントークン使用ガイド、Linear Style 高密度 UI 設計原則。 |

---

## ライセンス

本プロジェクトのライセンス情報については、リポジトリ内の `LICENSE` ファイルをご確認ください。
