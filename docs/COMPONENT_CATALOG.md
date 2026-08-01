# コンポーネント & モジュール カタログ (Component Catalog)

本ドキュメントは、ROS Waypoint Tool で使用されている UI コンポーネント、PixiJS 描画レイヤー、および主要モジュールの一覧と概要をまとめたカタログです。

---

## 1. 汎用・共通 UI コンポーネント (Common UI Elements)

### 共通基本部品 (`src/components/ui/common/`)
- **`FloatingActionBanner`** ([`src/components/ui/common/FloatingActionBanner.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/FloatingActionBanner.tsx))
  - **概要**: モード操作時（コピー、領域選択等）にキャンバス上部に浮遊表示されるバナー通知・アクションUI。
  - **主要Props**: `icon`, `title`, `subtitle`, `valueDisplay`, `statusText`, `actions`
- **`PanelContainer`** ([`src/components/ui/PanelContainer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PanelContainer.tsx))
  - **概要**: 左右サイドパネル（インスペクターやツリー）を格納し、タブ切り替えおよび上下分割・リサイズを制御するコンテナ。
  - **主要Props**: なし（`useAppStore` からパネルレイアウト状態を直接制御）
- **`NumericInput`** ([`src/components/ui/NumericInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/NumericInput.tsx))
  - **概要**: 数値編集用インプット。ドラッグによる値変更やステップ増減、フォーカス外確定をサポート。
  - **主要Props**: `value`, `onChange`, `step`, `min`, `max`, `precision`
- **`ElementCopyOverlay`** ([`src/components/ui/ElementCopyOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ElementCopyOverlay.tsx))
  - **概要**: 複数要素や特定の座標・プロパティを別のノードへ連続コピーする際のキャンバスオーバーレイ。
  - **主要Props**: なし（コピー状態を `appStore` より読み出し表示）
- **`Modal`** ([`src/components/ui/common/Modal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Modal.tsx))
  - **概要**: 汎用モーダルダイアログコンテナ（アニメーション背景・ヘッダー・フッター標準化）。
  - **主要Props**: `isOpen`, `onClose`, `title`, `children`, `footer`
- **`Button`** ([`src/components/ui/common/Button.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Button.tsx))
  - **概要**: デザインシステムに準拠したボタン要素 (`variant`: primary / secondary / danger / ghost 等)。
  - **主要Props**: `variant`, `size`, `isLoading`, `disabled`, `onClick`
- **`Input`** / **`Select`** / **`Slider`** / **`Checkbox`** / **`Label`** ([`src/components/ui/common/`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/))
  - **概要**: 統一されたダークテーマ適用済みの各種標準フォームコンポーネント。
- **`EmptyState`** ([`src/components/ui/common/EmptyState.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/EmptyState.tsx))
  - **概要**: リストなどが空の場合のプレースホルダー表示用コンポーネント。
  - **主要Props**: `message`
- **`FormField`** ([`src/components/ui/common/FormField.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/FormField.tsx))
  - **概要**: ラベル、説明文、コントロール要素を一式にまとめたレイアウト部品。
  - **主要Props**: `label`, `description`, `children`
- **`OptionCard`** ([`src/components/ui/common/OptionCard.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/OptionCard.tsx))
  - **概要**: 設定モーダルなどで利用されるチェックボックス付き大型カード。
  - **主要Props**: `checked`, `onChange`, `title`, `description`, `children`
- **`BrowseInput`** ([`src/components/ui/common/BrowseInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/BrowseInput.tsx))
  - **概要**: ファイルやフォルダのパス入力欄と Browse ボタンを一体化した共通コンポーネント。
  - **主要Props**: `value`, `onChange`, `placeholder`, `dialogOptions`, `size`
- **`AlertBox`** ([`src/components/ui/common/AlertBox.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/AlertBox.tsx))
  - **概要**: パネルやモーダルで警告やエラーメッセージを表示するためのバナー部品。
  - **主要Props**: `title`, `variant`, `icon`, `children`


---

## 2. プロパティ・属性インスペクターコンポーネント (`src/components/ui/properties/`)

- **`TransformGroup`** ([`src/components/ui/properties/TransformGroup.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/TransformGroup.tsx))
  - **概要**: Waypoint ノードの位置 (X, Y, Z) および姿勢 (Yaw 角・クォータニオン) を編集するフォーム。
  - **主要Props**: `transform`, `onChange`
- **`AnchorTransformGroup`** ([`src/components/ui/properties/AnchorTransformGroup.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/AnchorTransformGroup.tsx))
  - **概要**: アンカーポイント（親基準点）に対する相対座標表示およびアンカー設定操作パネル。
  - **主要Props**: `nodeId`, `anchorId`
- **`RelativeTransformGroup`** ([`src/components/ui/properties/RelativeTransformGroup.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/RelativeTransformGroup.tsx))
  - **概要**: 特定の基準ノードからの相対距離・相対角度のリアルタイム算出・入力フィールド。
  - **主要Props**: `targetNode`, `baseNode`
- **`CustomOptionsGroup`** ([`src/components/ui/properties/CustomOptionsGroup.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/CustomOptionsGroup.tsx))
  - **概要**: プロジェクトで定義された Schema（速度、モード等）に基づき動的生成されるプロパティ入力群。
  - **主要Props**: `options`, `schema`, `onChange`
- **`GeneratorNodePanel`** ([`src/components/ui/properties/GeneratorNodePanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/GeneratorNodePanel.tsx))
  - **概要**: 生成されたジェネレーターノードの再編集・引数調整・Waypoint展開 (Explode) を行うUI。
  - **主要Props**: `nodeId`
- **`IndexGroup`** / **`ElementCopyContextMenu`** ([`src/components/ui/properties/`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/))
  - **概要**: Waypoint インデックス変更および右クリックコンテキストメニューによる値の特定コピー機能。
- **`TransformField`** ([`src/components/ui/properties/TransformField.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/TransformField.tsx))
  - **概要**: 座標軸 (X, Y, Z, Yaw) のラベル、入力、アクティブコピー状態表示をカプセル化したプロパティフィールド部品。
  - **主要Props**: `label`, `value`, `precision`, `variant`, `isCopying`, `onChange`
- **`PropertySectionHeader`** ([`src/components/ui/properties/PropertySectionHeader.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/PropertySectionHeader.tsx))
  - **概要**: 属性パネル内の可視性トグル付きセクションヘッダー部品。
  - **主要Props**: `title`, `isVisible`, `onToggleVisible`, `toggleTitle`


---

## 3. アプリケーション機能パネル & モーダル (`src/components/ui/`)

- **`TopMenu`** ([`src/components/ui/TopMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/TopMenu.tsx))
  - **概要**: アプリケーション最上部のメニューバー (File, Edit, View, Help) およびプロジェクトタイトル表示。
  - **主要Props**: なし
- **`ToolPanel`** ([`src/components/ui/ToolPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ToolPanel.tsx))
  - **概要**: 画面左側に配置されるメインツール切り替えバー (Select, Add Waypoint, Pan, Generator一覧等)。
  - **主要Props**: なし
- **`LayerPanel`** ([`src/components/ui/LayerPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/LayerPanel.tsx))
  - **概要**: ロード中のマップレイヤー管理パネル（表示切り替え、不透明度調整、順序追加・削除）。
  - **主要Props**: なし
- **`WaypointTree`** ([`src/components/ui/WaypointTree.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/WaypointTree.tsx))
  - **概要**: 全 Waypoint / ジェネレーター要素を階層表示・ドラッグ＆ドロップで並び替えるツリーペイン。
  - **主要Props**: なし
- **`PropertiesPanel`** ([`src/components/ui/PropertiesPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PropertiesPanel.tsx))
  - **概要**: 現在選択されている Waypoint またはジェネレーターの属性を編集するインスペクター右ペイン。
  - **主要Props**: なし
- **`PluginListPanel`** ([`src/components/ui/PluginListPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PluginListPanel.tsx))
  - **概要**: 利用可能なプラグイン（経路自動生成アルゴリズム）を一覧表示し、クリックで起動するサイドパネル。
  - **主要Props**: `onSelectPlugin`
- **`PluginParamsPanel`** ([`src/components/ui/PluginParamsPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PluginParamsPanel.tsx))
  - **概要**: 選択中プラグインの実行パラメータ設定・インタラクション入力トリガーフォーム。
  - **主要Props**: `pluginId`
- **`PluginInputEditor`** ([`src/components/ui/PluginInputEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PluginInputEditor.tsx))
  - **概要**: プラグインが必要とする入力（座標 `point` や領域 `rectangle`）の定義・編集エディタ。
  - **主要Props**: `inputDef`, `value`, `onChange`
- **`ExportModal`** / **`ExportMapsModal`** ([`src/components/ui/ExportModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ExportModal.tsx))
  - **概要**: Handlebars テンプレートによる Waypoint エクスポート画面、および切り出しマップ画像の単体エクスポートモーダル。
  - **主要Props**: `isOpen`, `onClose`
- **`SettingsModal`** ([`src/components/ui/SettingsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/SettingsModal.tsx))
  - **概要**: アプリ設定ダイアログ。`GeneralTab`, `OptionSchemaTab`, `ExportTemplatesTab`, `PluginsTab` を保持。
  - **主要Props**: `isOpen`, `onClose`
- **`TabSectionHeader`** ([`src/components/ui/settings/TabSectionHeader.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/TabSectionHeader.tsx))
  - **概要**: 設定モーダル内の各設定タブ専用ヘッダー部品。
  - **主要Props**: `title`, `subtitle`, `actions`
- **`KeyboardShortcutsModal`** ([`src/components/ui/KeyboardShortcutsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/KeyboardShortcutsModal.tsx))
  - **概要**: 定義されているショートカットキー一覧を表示するヘルプダイアログ。
  - **主要Props**: `isOpen`, `onClose`
- **`StatusBar`** ([`src/components/ui/StatusBar.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/StatusBar.tsx))
  - **概要**: 画面最下部にマウスのワールド座標 (X, Y)、現在のズーム倍率、アクティブツール状態を表示するバー。
  - **主要Props**: なし

---

## 4. 描画・Canvas コンポーネント (`src/components/canvas/`)

- **`MapCanvas`** ([`src/components/canvas/MapCanvas.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/MapCanvas.tsx))
  - **概要**: PixiJS ビューポートの初期化、パン/ズームインタラクション、および描画サブレイヤーの統括を行うコアキャンバス。
  - **主要Props**: なし
- **`MapCanvasPlaceholder`** ([`src/components/canvas/MapCanvasPlaceholder.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/MapCanvasPlaceholder.tsx))
  - **概要**: マップ未読み込み時にキャンバス上に表示されるウェルカム・ドロップエリアガイド UI。
  - **主要Props**: `onOpenMap`

### Canvas レイヤー群 (`src/components/canvas/layers/`)
- **`WaypointLayer`** ([`src/components/canvas/layers/WaypointLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/WaypointLayer.tsx))
  - **概要**: Waypoint 矢印マーカー、インデックスラベル、回転ハンドルの高速 WebGL 描画およびドラッグ操作判定。
- **`PathLayer`** ([`src/components/canvas/layers/PathLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/PathLayer.tsx))
  - **概要**: Waypoint 同士を接続するライン・順序矢印・軌跡の描画。
- **`GridLayer`** ([`src/components/canvas/layers/GridLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/GridLayer.tsx))
  - **概要**: 1m メッシュなどのワールドグリッド線の描画。
- **`PluginLayer`** ([`src/components/canvas/layers/PluginLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/PluginLayer.tsx))
  - **概要**: プラグインの自動生成プレビュー結果および Interaction Hints 補助視覚要素の描画。
- **`SnappingGuideLayer`** ([`src/components/canvas/layers/SnappingGuideLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/SnappingGuideLayer.tsx))
  - **概要**: Waypoint 追加・移動時の直交スナップガイド線および数値スナップインジケーター描画。
- **`ExportRegionLayer`** ([`src/components/canvas/layers/ExportRegionLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/ExportRegionLayer.tsx))
  - **概要**: マップ部分エクスポート時の選択バウンディングボックスの描画。

---

## 5. アプリケーション共通非描画モジュール (`src/components/common/`)

- **`ShortcutManager`** ([`src/components/common/ShortcutManager.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/common/ShortcutManager.tsx))
  - **概要**: グローバルショートカットキー (`Ctrl+S`, `Ctrl+Z`, `V`, `P` 等) のイベントを一括トリガーする Headless コンポーネント。
  - **主要Props**: なし

---

## 6. コアストア & ユーティリティ (`src/stores/`, `src/utils/`)

- **`useAppStore`** ([`src/stores/appStore.ts`](file:///home/chuson/develop/waypoint-tool/src/stores/appStore.ts))
  - **概要**: 全状態とアクション（`nodeSlice`, `mapSlice`, `pluginSlice`, `projectSlice`, `uiSlice`）を提供するメインフック。
- **`transformUtils`** ([`src/utils/transformUtils.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/transformUtils.ts))
  - **概要**: Quaternion ⇔ Yaw 変換、アンカー点基準の相対座標算出演算関数群。
  - **主要関数**: `quaternionToYaw`, `yawToQuaternion`, `calculateAnchorRelativeTransform`
