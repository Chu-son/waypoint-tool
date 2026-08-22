# Custom UI 機能 ガイド (Custom UI Guide)

本ドキュメントは、Waypoint Toolにおける Custom UI（専用ツール化・ホワイトラベル化・ワークフロー型UI）機能の設定仕様、記述フォーマット、および拡張方法に関するリファレンスです。

---

## 1. 概要 (Overview)

Custom UI機能を利用することで、Waypoint Toolのコア機能（マップ管理、Waypoint編集、幾何計算、プラグイン実行、エクスポート等）を維持したまま、**外部設定ファイル（`custom-ui.config.json`）を配置するだけで、アプリケーション名、ロゴ、テーマカラー、左右パネルの構成、ツールバー、およびワークフロー型ガイド画面を上書き・専用ツール化**できます。

### 主なカスタマイズ可能領域
* **ブランディング**: アプリ名、ウィンドウタイトル、アプリアイコン、ロゴ画像、About画面
* **テーマ**: CSS変数によるコーポレートカラー設定、外部CSSファイルの動的注入
* **レイアウト & フィルタリング**: 左右パネルのタブ構成・デフォルト幅・分割表示、ツールバー/メニュー項目の表示・非表示
* **ワークフローガイド**: 初心者・現場オペレーター向けのステップバイステップ案内画面（自動モード連動・パラメータ簡略化・ワンクリックアクション）
* **カスタムWebパネル**: ユーザー自作のHTMLファイルや外部Webダッシュボードのタブ埋め込み

---

## 2. 設定ファイルの配置と自動検出 (Config File Placement)

アプリケーション起動時、以下の優先順位で **`custom-ui.config.json`** を探索し、見つかった場合に自動適用されます。

1. ユーザー設定ディレクトリ (`~/.config/waypoint-tool/custom-ui.config.json` 等)
2. アプリケーション実行ファイルと同階層 (ポータブル配布・AppImage・macOS bundle)
3. カレントワーキングディレクトリ / ソースツリー直下 (開発環境)

> [!TIP]
> **管理者向けモード切替**:
> Custom UIモードが適用されている場合でも、TopMenuの **「Help」→「✓ Custom UI Mode (Switch to Standard)」** をクリックすることで、即座にフル機能の通常モードと行き来が可能です。

---

## 3. 設定ファイルスキーマ (`custom-ui.config.json`)

すべての設定ブロックは**オプショナル（省略可能）**であり、カスタマイズしたい部分のみを記述できます。
エディタでの入力補完用に `$schema: "./schema/custom-ui-config.schema.json"` を指定できます。

```json
{
  "$schema": "./schema/custom-ui-config.schema.json",
  "brand": {
    "appName": "Roomba Route Creator",
    "windowTitle": "Roomba Route Creator - お掃除経路エディタ",
    "icon": "Bot",
    "logoUrl": "./assets/logo.svg",
    "about": {
      "title": "Roomba Route Creator v1.0",
      "description": "初心者向けお掃除ロボット経路設定ツール",
      "company": "Robotics Clean Solutions"
    }
  },
  "theme": {
    "cssVariables": {
      "--color-primary-base": "#10b981",
      "--color-primary-hover": "#059669"
    },
    "customCssPath": "./custom.css"
  },
  "layout": {
    "showWelcomeModal": false,
    "topMenu": {
      "hiddenItemIds": ["help_devtools", "file_export_maps"]
    },
    "toolPanel": {
      "visibleTools": ["select", "add_point", "add_rect_sweep"],
      "allowImport": false,
      "allowExport": true,
      "allowSettings": false
    },
    "leftPanel": {
      "defaultOpen": true,
      "defaultWidth": 340,
      "viewMode": "tabs",
      "tabs": [
        { "type": "workflow", "id": "workflow", "title": "お掃除手順ガイド" },
        { "type": "builtin", "id": "project", "title": "詳細地点一覧" }
      ]
    },
    "rightPanel": {
      "defaultOpen": true,
      "defaultWidth": 320,
      "viewMode": "tabs",
      "tabs": [
        { "type": "builtin", "id": "inspector", "title": "属性設定" },
        { "type": "builtin", "id": "layers", "title": "マップレイヤー" }
      ]
    }
  },
  "workflow": {
    "id": "cleaning_flow",
    "title": "お掃除ルート作成ワークフロー",
    "steps": [
      {
        "id": "step_1",
        "title": "1. 新規プロジェクト",
        "description": "新しいお掃除計画を開始します。",
        "actionButton": { "label": "初期化して開始", "action": "reset_project" }
      },
      {
        "id": "step_2",
        "title": "2. 間取りマップの読み込み",
        "description": "部屋のマップ画像を選択してください。",
        "actionButton": { "label": "マップファイルを開く", "action": "open_map_dialog" },
        "onEnter": { "actions": ["triggerFitToMaps"] }
      },
      {
        "id": "step_3",
        "title": "3. ロボットサイズの確認",
        "description": "お掃除ロボットの直径を設定します。",
        "controls": [
          {
            "type": "slider",
            "target": { "action": "setRobotFootprintRadius" },
            "label": "本体の半径 (m)",
            "min": 0.1,
            "max": 0.5,
            "step": 0.01,
            "default": 0.18
          }
        ],
        "onEnter": { "state": { "showFootprints": true } }
      }
    ]
  }
}
```

---

## 4. パネルタブの種類と指定方法

左右パネル（`leftPanel.tabs` / `rightPanel.tabs`）では、以下のタブタイプを指定できます。

| type | 説明 | 主なパラメータ |
|---|---|---|
| `builtin` | 既存の標準パネル（Waypoints, Layers, Inspector, Plugins） | `id: 'project' \| 'layers' \| 'inspector' \| 'plugins'` |
| `workflow` | ワークフロー案内パネル | `id: 'workflow'`, `title` |
| `html_file` | ローカルHTMLファイルを `iframe` 埋め込み | `id`, `title`, `src: './my_panel.html'` |
| `html_inline` | インラインHTML/CSS文字列を描画 | `id`, `title`, `html`, `css` |
| `url` | 外部Web URLを `iframe` 埋め込み | `id`, `title`, `url: 'http://localhost:8080'` |

---

## 5. ワークフローアクション一覧 (Workflow Actions)

| アクション名 | 説明 |
|---|---|
| `reset_project` | プロジェクトを新規初期化 |
| `open_map_dialog` | ファイル選択ダイアログを開き、ROSマップ/画像マップを読み込み |
| `triggerFitToMaps` | キャンバスのズーム/パンをロード済みマップ全体にフィット |
| `ensureCustomLayer` | カスタムレイヤーが存在しない場合に新規作成 (`args: { layerName: "..." }`) |
| `setRobotFootprintRadius` | ロボットの円形Footprint半径を変更 (`args: { value: 0.2 }`) |
| `run_active_plugin` | アクティブなプラグインを実行してノードを生成 |
| `open_export_modal` | ウェイポイントエクスポートモーダルを開く |
| `open_import_modal` | ウェイポイントインポートモーダルを開く |
| `open_settings_modal` | 設定モーダルを開く (`args: { tab: "general" }`) |
