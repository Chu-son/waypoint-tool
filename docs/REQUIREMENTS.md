# システム要件定義 (Requirements)

本ドキュメントは、ROS Waypoint Tool の主な要件とゴールを定義します。

## 概要 (Overview)
ROS(ROS2)のNavigationパッケージと組み合わせて使用する、自律移動ロボット向け「Waypoint作成ツール」のPC向けデスクトップアプリケーション。TauriとReact(PixiJS)を利用した単一の実行バイナリとして配布可能。

## 機能要件 (Functional Requirements)

### 1. マップ表示 (Map Visualization)
- ROS標準の 2D Occupancy Grid Map ファイル（YAMLメタデータ + PGM/PNG画像）を読み込めること。
- 白（空き領域）、黒（障害物）、グレー（未知領域）のマップ上に、Waypointや軌跡を描画できること。
- マウスドラッグによる「パン（移動）」と、マウスホイールによる「ズーム（拡大・縮小）」操作が可能であること。

### 2. Waypointの作成・編集 (Waypoint Editing)
- キャンバス上をクリックすることで、任意の位置にWaypoint（通過点）を作成できること。
- Waypointには「位置（X, Y座標）」と「姿勢（ヨー角/Yaw）」が視覚的に表現されること（例: 矢印マーカー）。
- Waypointの基本情報（ID, 座標, 角度）をエディタパネル（Inspector）から直接数値編集できること。
- 複数の要素を選択し（Ctrl+クリックなど）、一括編集や削除が可能であること。

### 3. オプションプロパティの拡張 (Option Properties)
- Waypointごとに「目標速度」「停止時間」「動作モード（ドッキング、リレージャンプ等）」といった任意の追加属性(Options)を設定できること。
  - 値の型として `string`, `float`, `integer`, `boolean`, `list` (要素の型を指定できる配列) に対応し、GUIのSettingsダイアログから動的に追加・編集できること。
- これらの属性スキーマはプロジェクトファイル(`.wptroj`)内で管理され、フロントエンドのプロパティパネルに動的に入力フォームを生成すること。

### 4. 自動生成機能・非破壊編集 (Generators & Non-Destructive Editing)
- 手動のポイント追加に加え、「矩形領域を一定間隔で走査する」などの高度なWaypoint自動生成（ジェネレータ）機能をサポートすること（非破壊のまま保持可能）。
- Generator Node と Manual Node のツリー構造を内部で持ち、GUIの左ペイン（Hierarchy）に表現されること。

### 5. 入出力 (Data Export / Import)
- 作業状態全体を保存できる内部プロジェクトファイル(`.wptroj`)の保存・読み込み機能。
- ロボットへ転送する最終出力を生成するエクスポート機能（YAML, JSON, CSVの複数形式対応）。
- 独自形式のテンプレートを出力できる Handlebars エンジンへの対応。

## 非機能要件 (Non-Functional Requirements)

- **クロスプラットフォーム動作**: Windows, Linuxでネイティブに動作すること（Tauriの採用）。
- **高パフォーマンス**: 数千個のWaypointや巨大なPGMマップを読み込んでもUIがフリーズしないこと（PixiJS等のWebGLレンダラとRustの活用）。
- **配布容易性**: ランタイム（Node.jsやPython等）の事前インストールを必要とせず、単一の実行ファイルによる配布が可能であること。
- **拡張性**: 将来の3Dグラフィクス（React Three Fiber等）の切り替えや、新しい自動生成アルゴリズムの追加が容易な「疎結合な設計」になっていること。
