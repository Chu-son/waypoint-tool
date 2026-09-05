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
- **`LoadingOverlay`** ([`src/components/ui/common/LoadingOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/LoadingOverlay.tsx))
  - **概要**: 重い非同期処理（プラグイン実行、マージプレビュー生成、インポート/エクスポート等）実行時に全画面を半透明ブラー暗転させて操作をブロックする共通ローディングオーバーレイ。
  - **主要Props**: `className`
- **`BackgroundLoadingBadge`** ([`src/components/ui/common/BackgroundLoadingBadge.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/BackgroundLoadingBadge.tsx))
  - **概要**: 自動経路計算等の非ブロッキングバックグラウンド処理時にキャンバス右上に浮遊表示されるコンパクトなピル型インジケーター。
  - **主要Props**: `className`
- **`ElementCopyOverlay`** ([`src/components/ui/ElementCopyOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ElementCopyOverlay.tsx))
  - **概要**: 複数要素や特定の座標・プロパティを別のノードへ連続コピーする際のキャンバスオーバーレイ。
  - **主要Props**: なし（コピー状態を `appStore` より読み出し表示）
- **`AnnotationEditOverlay`** ([`src/components/ui/AnnotationEditOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/AnnotationEditOverlay.tsx))
  - **概要**: アノテーションオブジェクト（Point, OrientedPoint, Line, Rect, Circle）の配置・編集モード時にキャンバス上部に表示されるフローティングアクションバナー（サブツール・カラー選択・削除・完了）。
  - **主要Props**: なし
- **`MapEditOverlay`** ([`src/components/ui/MapEditOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/MapEditOverlay.tsx))
  - **概要**: マップ編集モード時にキャンバス上部に表示されるフローティングアクションバナー（直線・矩形・円形・ブラシのサブツール切り替え、塗りつぶし値設定、ブラシサイズ、削除、完了）。
  - **主要Props**: なし
- **`Modal`** ([`src/components/ui/common/Modal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Modal.tsx))
  - **概要**: 汎用モーダルダイアログコンテナ（アニメーション背景・ヘッダー・フッター標準化）。
  - **主要Props**: `isOpen`, `onClose`, `title`, `children`, `footer`
- **`Button`** ([`src/components/ui/common/Button.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Button.tsx))
  - **概要**: デザインシステムに準拠したボタン要素 (`variant`: primary / secondary / outline / danger / ghost 等)。デスクトップ高密度（32px: `default`、28px: `sm`、24px: `xs`）および `rounded-md` 準拠。
  - **主要Props**: `variant`, `size` (`default` | `sm` | `xs` | `icon` | `icon-sm`), `isLoading`, `disabled`, `onClick`
- **`Kbd`** ([`src/components/ui/common/Kbd.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Kbd.tsx))
  - **概要**: キーボードショートカットやキーバインドを美しく統一表示するキーキャップバッジ。
  - **主要Props**: `children`, `className`
- **`DynamicIcon`** ([`src/components/common/DynamicIcon.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/common/DynamicIcon.tsx))
  - **概要**: Lucide React のアイコン名文字列（例: `"FolderOpen"`, `"MapPin"`, `"Play"` 等）から安全に動的アイコンを描画する共通ヘルパーコンポーネント。
  - **主要Props**: `name`, `size`, `className`, `fallback`
- **`Input`** / **`Select`** / **`Slider`** / **`Checkbox`** / **`Label`** ([`src/components/ui/common/`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/))
  - **概要**: 統一されたダークテーマ適用済みの各種標準フォームコンポーネント。デスクトップ高密度（`h-8`, `text-[13px]`, `rounded-md`）準拠。
- **`EmptyState`** ([`src/components/ui/common/EmptyState.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/EmptyState.tsx))
  - **概要**: リストなどが空の場合のプレースホルダー表示用コンポーネント。Linear Style準拠（過度なアニメーションや丸みを排した `rounded-lg border` 構造）。
  - **主要Props**: `message`
- **`FormField`** ([`src/components/ui/common/FormField.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/FormField.tsx))
  - **概要**: ラベル、説明文、コントロール要素を一式にまとめたレイアウト部品。
  - **主要Props**: `label`, `description`, `children`
- **`OptionCard`** ([`src/components/ui/common/OptionCard.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/OptionCard.tsx))
  - **概要**: 設定モーダルなどで利用されるチェックボックス付き大型カード（`rounded-lg`）。
  - **主要Props**: `checked`, `onChange`, `title`, `description`, `children`
- **`BrowseInput`** ([`src/components/ui/common/BrowseInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/BrowseInput.tsx))
  - **概要**: ファイルやフォルダのパス入力欄と Browse ボタンを一体化した共通コンポーネント（デスクトップ高密度 `h-8` / `h-7`）。
  - **主要Props**: `value`, `onChange`, `placeholder`, `dialogOptions`, `size`
- **`AlertBox`** ([`src/components/ui/common/AlertBox.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/AlertBox.tsx))
  - **概要**: パネルやモーダルで警告やエラーメッセージを表示するためのバナー部品。
  - **主要Props**: `title`, `variant`, `icon`, `children`
- **`FieldLabel`** ([`src/components/ui/common/FieldLabel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/FieldLabel.tsx))
  - **概要**: フォーム入力箇所の共通大文字ラベル部品。
  - **主要Props**: `children`, `className`
- **`SectionDivider`** ([`src/components/ui/common/SectionDivider.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/SectionDivider.tsx))
  - **概要**: サブセクションのタイトルと自動伸縮する横線を一体化した見出し部品。
  - **主要Props**: `title`, `action`, `className`
- **`InlineFieldRow`** ([`src/components/ui/common/InlineFieldRow.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/InlineFieldRow.tsx))
  - **概要**: 横並びのラベル＋入力コントロールを均一にレイアウトする部品。
  - **主要Props**: `label`, `children`, `className`
- **`LabeledNumericInput`** ([`src/components/ui/common/LabeledNumericInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/LabeledNumericInput.tsx))
  - **概要**: ラベルと数値入力 (NumericInput) を組み合わせた統一入力部品。
  - **主要Props**: `label`, `value`, `onChange`, `precision`, `step`
- **`ToggleSwitch`** ([`src/components/ui/common/ToggleSwitch.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/ToggleSwitch.tsx))
  - **概要**: ON/OFF 状態を保持するアクセシブルなカスタムトグルスイッチ部品。
  - **主要Props**: `checked`, `onChange`, `disabled`, `title`


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
- **`CustomLayerInspector`** ([`src/components/ui/properties/CustomLayerInspector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/CustomLayerInspector.tsx))
  - **概要**: 手動ベクター描画レイヤー（直線・矩形・円形・ブラシ）のツール設定や、プラグイン生成マップレイヤーの新規作成・パラメータ編集・再生成・透過度・ブレンドモード調整を行う統合インスペクターUI。
  - **主要Props**: なし（`appStore` の `activeCustomLayerId` と連動）
- **`AnnotationInspector`** ([`src/components/ui/properties/AnnotationInspector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/AnnotationInspector.tsx))
  - **概要**: 選択中のアノテーションオブジェクト（Point, OrientedPoint, Line, Rect, Circle）の名前・カラー・表示トグル・各幾何座標（位置、サイズ、角度、半径等）を編集するインスペクターUI。
  - **主要Props**: なし（`appStore` の `selectedAnnotationIds` と連動）
- **`NewCustomLayerModal`** ([`src/components/ui/NewCustomLayerModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/NewCustomLayerModal.tsx))
  - **概要**: 新規カスタムレイヤー作成モーダル。手動ベクターレイヤーの追加、または `map_layer_generator` プラグインの一覧から選択してレイヤーを作成する。
  - **主要Props**: `isOpen`, `onClose`
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
- **`PathRouterMenu`** ([`src/components/ui/PathRouterMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PathRouterMenu.tsx))
  - **概要**: トップバーに配置されるパス計算アルゴリズム選択、パラメータ設定、自動再計算トグル用ドロップダウンメニュー。
  - **主要Props**: なし
- **`ToolPanel`** ([`src/components/ui/ToolPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ToolPanel.tsx))
  - **概要**: 画面左端に配置されるメインツール切り替えバー (Select, Add Waypoint, Export Region, Import/Export/Settings等)。
  - **主要Props**: なし
- **`LayerPanel`** ([`src/components/ui/LayerPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/LayerPanel.tsx))
  - **概要**: ロード中のマップレイヤー管理パネル（表示切り替え、不透明度調整、順序追加・削除）。
  - **主要Props**: なし
- **`ObjectsPanel`** ([`src/components/ui/ObjectsPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ObjectsPanel.tsx))
  - **概要**: ウェイポイントツリー (`WaypointTree`) とアノテーション一覧 (`AnnotationTree`) を統合してホストする左サイドバーのメインオブジェクトパネル。
  - **主要Props**: なし
- **`WaypointTree`** ([`src/components/ui/WaypointTree.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/WaypointTree.tsx))
  - **概要**: 全 Waypoint / ジェネレーター要素を階層表示・ドラッグ＆ドロップで並び替えるツリーペイン。Shiftキーによる範囲選択、不連続選択を含む複数ノードの一括ドラッグ並び替え（連続化配置 & DragOverlayによるスタックカード視覚表示）、右クリックコンテキストメニュー（単一/複数選択項目の一括複製・一括削除・アンカー設定・内部プロパティ表示・Explode）に対応。
  - **主要Props**: なし
- **`AnnotationTree`** ([`src/components/ui/AnnotationTree.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/AnnotationTree.tsx))
  - **概要**: アノテーションオブジェクトの一覧表示、ドラッグ＆ドロップ並び替え、可視性/ラベル表示トグル、削除、名前編集、複製、配置モード開始トリガーを提供するコンポーネント。
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
  - **概要**: プラグインが必要とする入力（座標 `point`、点群 `points`、領域 `rectangle`、参照 `waypoint`、アノテーション `annotation`、カスタムレイヤー `custom_layer`）の定義・編集エディタ。
  - **主要Props**: `inputDef`, `value`, `onChange`
- **`ExportModal`** / **`ExportMapsModal`** ([`src/components/ui/ExportModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ExportModal.tsx))
  - **概要**: Handlebars テンプレートによる Waypoint エクスポート画面、および切り出しマップ画像の単体エクスポートモーダル。
  - **主要Props**: `isOpen`, `onClose`
- **`SettingsModal`** ([`src/components/ui/SettingsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/SettingsModal.tsx))
  - **概要**: アプリ設定ダイアログ。`GeneralTab`, `OptionSchemaTab`, `RobotFootprintTab`, `ExportTemplatesTab`, `PluginsTab` を保持。
  - **主要Props**: `isOpen`, `onClose`
- **`RobotFootprintTab`** ([`src/components/ui/settings/RobotFootprintTab.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/RobotFootprintTab.tsx))
  - **概要**: ロボットのフットプリント（円形・矩形・多角形）の定義・寸法設定・ROS Nav2 形式テキスト入出力、およびリアルタイム SVG プレビュー。
  - **主要Props**: なし
- **`TabSectionHeader`** ([`src/components/ui/settings/TabSectionHeader.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/TabSectionHeader.tsx))
  - **概要**: 設定モーダル内の各設定タブ専用ヘッダー部品。
  - **主要Props**: `title`, `subtitle`, `actions`
- **`PathRouterMenu`** ([`src/components/ui/PathRouterMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PathRouterMenu.tsx))
  - **概要**: トップバーに常駐するパス計算・ルーター設定ポップアップメニュー。経路補間アルゴリズム（直線 / Dijkstra等）の選択、パラメータ設定、自動再計算トグル、パス色・透過度・線幅・Footprint幅同期などの表示設定を提供。
  - **主要Props**: なし
- **`KeyboardShortcutsModal`** ([`src/components/ui/KeyboardShortcutsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/KeyboardShortcutsModal.tsx))
  - **概要**: 定義されているショートカットキー一覧を表示するヘルプダイアログ。
  - **主要Props**: `isOpen`, `onClose`
- **`WelcomeModal`** ([`src/components/ui/WelcomeModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/WelcomeModal.tsx))
  - **概要**: ツール起動時およびファイルメニューから呼び出せるプロジェクト選択・ウェルカム画面。新規作成、既存プロジェクトを開く、直近開いたプロジェクト一覧のロードを提供。
  - **主要Props**: `isOpen`, `onClose`
- **`ThemeInjector`** ([`src/components/ui/ThemeInjector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/ThemeInjector.tsx))
  - **概要**: `customUiConfig.theme` に定義されたカラープリセット、カスタムCSS変数、動的 `color-scheme` を DOM の `:root` に注入し、アンマウント時にクリーンアップするインジェクターコンポーネント。
  - **主要Props**: なし
- **`WorkflowPanel`** ([`src/components/ui/WorkflowPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/WorkflowPanel.tsx))
  - **概要**: Custom UI モード時にステップバイステップの作業手順をガイドするワークフローパネル。各ステップのアクションボタン、簡易パラメータ、プラグイン入力フォームを表示。
  - **主要Props**: なし
- **`CustomHtmlPanel`** ([`src/components/ui/CustomHtmlPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/CustomHtmlPanel.tsx))
  - **概要**: 外部 HTML ファイルまたはインライン HTML を iframe 経由でパネル内に安全に描画し、PostMessage 経由でアプリ側アクションを呼び出すカスタムパネル。
  - **主要Props**: `tabDef`
- **`PanelRegistry`** ([`src/components/ui/PanelRegistry.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/PanelRegistry.tsx))
  - **概要**: パネルタブID（`project`, `inspector`, `layers`, `plugins`, `workflow`, `custom_html` 等）から対応するパネルコンポーネントを動的に解決・レンダリングするレジストリモジュール。
  - **主要Props**: なし
- **`StatusBar`** ([`src/components/ui/StatusBar.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/StatusBar.tsx))
  - **概要**: 画面最下部に常駐する高機能ステータスバー。状態機械と連動した「現在のモードバッジ」および「Escキー遷移先（Next on Esc）ボタン」、バックグラウンドタスク進捗、カーソル世界座標 (X, Y)・相対極座標・ローカル座標、挿入位置インジケータ、選択ノード数/総数カウンター、全経路長 (m)、未保存 (Dirty) インジケータ＆保存ボタン、スナップON/OFFトグル、マップ解像度 (m/px)、ズーム倍率および Fit ボタンを表示。
  - **主要Props**: なし

---

## 4. 描画・Canvas コンポーネント (`src/components/canvas/`)

- **`MapCanvas`** ([`src/components/canvas/MapCanvas.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/MapCanvas.tsx))
  - **概要**: PixiJS ビューポートの初期化、パン/ズームインタラクション、および描画サブレイヤーの統括を行うコアキャンバス。
  - **主要Props**: なし
- **`MapCanvasPlaceholder`** ([`src/components/canvas/MapCanvasPlaceholder.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/MapCanvasPlaceholder.tsx))
  - **概要**: マップ未読み込み時にキャンバス上に表示されるウェルカム・ドロップエリアガイド UI。
  - **主要Props**: `onOpenMap`

### Canvas 10層描画スタック順序 (Render & Event Priority Hierarchy)
`MapCanvas.tsx` における WebGL コンテナの重なり順（背面から前面）およびポインターイベント優先順位は以下の通り厳格に規定されています：
1. **`MapLayerSprite` (Base Map)**: 背景ROSマップ画像の表示
2. **`Custom Layers` (Raster / Manual Vector)**: 手動ベクター描画およびプラグイン生成カスタムレイヤー
3. **`GridLayer`**: 1m メッシュ等のワールドグリッド線
4. **`PathLayer`**: ウェイポイント間パス補間線・コリドー帯
5. **`FootprintLayer`**: ロボット形状フットプリント表示
6. **`AnnotationLayer`**: アノテーション図形（Point, Line, Rect, Circle等）
7. **`WaypointLayer`**: ウェイポイント矢印マーカー、ラベル、回転ハンドル
8. **`PluginLayer`**: プラグイン自動生成プレビューおよび Interaction Hints 視覚補助
9. **`ExportRegionLayer`**: マップ切り出しエクスポート枠
10. **`SnappingGuideLayer`**: 直交スナップガイド線および数値入力 HUD（最前面）

### Canvas レイヤー & フィルター群 (`src/components/canvas/`)
- **`OccupancyHighlightFilter`** ([`src/components/canvas/filters/OccupancyHighlightFilter.ts`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/filters/OccupancyHighlightFilter.ts))
  - **概要**: マップ画像を 2D Occupancy Grid の 3 領域（Obstacle: 赤, Free: 緑, Unknown: 紫）にリアルタイム色分けする PixiJS GPU GLSL シェーダーフィルター。
- **`AnnotationLayer`** ([`src/components/canvas/layers/AnnotationLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/AnnotationLayer.tsx))
  - **概要**: Point (円), OrientedPoint (矢印), Line (線分), Rect (矩形), Circle (円形) のアノテーション図形、色枠線、半透明塗りつぶし、変形操作ハンドル、テキストラベルの高速 WebGL 描画およびインタラクション。
- **`MapEditLayer`** / **`MapEditSingleLayer`** ([`src/components/canvas/layers/MapEditLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/MapEditLayer.tsx))
  - **概要**: 手動カスタムレイヤー（ManualCustomLayer）の描画オブジェクト（Line, Rect, Circle, Freehand）の高速 WebGL 描画、塗りつぶし色反映、選択時のリサイズ・回転・端点操作ハンドル描画。
- **`FootprintLayer`** ([`src/components/canvas/layers/FootprintLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/FootprintLayer.tsx))
  - **概要**: 選択中の Waypoint および（表示トグル有効時の）全 Waypoint に対して、ロボットの向き (yaw) に合わせたフットプリント外枠・塗りつぶし・進行方向インジケーターを高速 WebGL 描画。
- **`WaypointLayer`** ([`src/components/canvas/layers/WaypointLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/WaypointLayer.tsx))
  - **概要**: Waypoint 矢印マーカー、インデックスラベル、回転ハンドルの高速 WebGL 描画およびドラッグ操作判定。
- **`PathLayer`** ([`src/components/canvas/layers/PathLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/PathLayer.tsx))
  - **概要**: Waypoint 同士を接続する直線およびプラグイン計算経路（Dijkstra 回避パス等）の描画。カスタマイズ可能な色・透過度・実寸メートル幅の半透明コリドー（通過帯）およびソリッド中心線のレンダリングに対応。
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
