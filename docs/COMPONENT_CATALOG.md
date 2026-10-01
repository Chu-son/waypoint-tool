# コンポーネント & モジュール カタログ (Component Catalog)

本ドキュメントは、ROS Waypoint Tool で使用されている UI コンポーネント、PixiJS 描画レイヤー、および主要モジュールの一覧と概要をまとめたカタログです。

---

## 1. 汎用・共通 UI コンポーネント (Common UI Elements)

### 共通基本部品 (`src/components/ui/common/`)
- **`FloatingActionBanner`** ([`src/components/ui/common/FloatingActionBanner.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/FloatingActionBanner.tsx))
  - **概要**: モード操作時（コピー、領域選択等）にキャンバス上部に浮遊表示されるバナー通知・アクションUI。
  - **主要Props**: `icon`, `title`, `subtitle`, `valueDisplay`, `statusText`, `actions`
- **`PanelContainer`** ([`src/components/ui/shell/PanelContainer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/PanelContainer.tsx))
  - **概要**: 左右サイドパネルを格納し、タブ切り替え、上下分割、タブ右クリックによる反対パネルへの移動（左右ドッキング）・順序並び替え、レイアウト初期化を制御するコンテナ。
  - **主要Props**: `panels`, `activeTabId`, `onTabChange`, `viewMode`, `onViewModeChange`, `side`, `onMoveTabToPanel`, `onReorderTab`, `onResetLayout`, `onClose`, `closeIcon`
- **`NumericInput`** ([`src/components/ui/common/NumericInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/NumericInput.tsx))
  - **概要**: 数値編集用インプット。入力中の中間状態を許容し、フォーカス外/Enter で確定。`step` 指定時は ↑/↓ キーで増減（Shift ×10、Alt ×0.1）。
  - **主要Props**: `value`, `onChange`, `step`, `min`, `max`, `precision`, `onEditStart`, `onEditEnd`
- **`PoseAdjuster`** ([`src/components/ui/common/PoseAdjuster.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/PoseAdjuster.tsx))
  - **概要**: 位置・回転を目視で合わせるためのナッジパッド。↑↓←→ 移動と CCW/CW 回転ボタン（長押しでリピート）、粗/中/細のステップ切替。フォーカス中は矢印キーで移動、Q/E で回転、Shift ×10・Alt ×0.1。座標系はワールド軸（+X 右, +Y 上, +yaw 反時計回り）の相対量 `PoseNudge` を通知するだけで、値の保持や適用は呼び出し側が行う。`MapLayerCard` と `GeoMapCard` で共用。
  - **主要Props**: `onNudge`, `onEditStart`, `onEditEnd`（押下/キー保持の一連操作を Undo 1 エントリにまとめるために使う）
- **`LoadingOverlay`** ([`src/components/ui/common/LoadingOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/LoadingOverlay.tsx))
  - **概要**: 重い非同期処理（プラグイン実行、マージプレビュー生成、インポート/エクスポート等）実行時に全画面を半透明ブラー暗転させて操作をブロックする共通ローディングオーバーレイ。
  - **主要Props**: `className`
- **`BackgroundLoadingBadge`** ([`src/components/ui/common/BackgroundLoadingBadge.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/BackgroundLoadingBadge.tsx))
  - **概要**: 自動経路計算等の非ブロッキングバックグラウンド処理時にキャンバス右上に浮遊表示されるコンパクトなピル型インジケーター。
  - **主要Props**: `className`
- **`ElementCopyOverlay`** ([`src/components/ui/overlays/ElementCopyOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/overlays/ElementCopyOverlay.tsx))
  - **概要**: 複数要素や特定の座標・プロパティを別のノードへ連続コピーする際のキャンバスオーバーレイ。
  - **主要Props**: なし（コピー状態を `appStore` より読み出し表示）
- **`AnnotationEditOverlay`** ([`src/components/ui/overlays/AnnotationEditOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/overlays/AnnotationEditOverlay.tsx))
  - **概要**: アノテーションオブジェクト（Point, OrientedPoint, Line, Rect, Circle）の配置・編集モード時にキャンバス上部に表示されるフローティングアクションバナー（サブツール・カラー選択・削除・完了）。
  - **主要Props**: なし
- **`MapEditOverlay`** ([`src/components/ui/overlays/MapEditOverlay.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/overlays/MapEditOverlay.tsx))
  - **概要**: マップ編集モード時にキャンバス上部に表示されるフローティングアクションバナー（直線・矩形・円形・ブラシのサブツール切り替え、塗りつぶし値設定、ブラシサイズ、削除、完了）。
  - **主要Props**: なし
- **`Modal`** ([`src/components/ui/common/Modal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Modal.tsx))
  - **概要**: 汎用モーダルダイアログコンテナ（アニメーション背景・ヘッダー・フッター標準化）。開いている `Modal` は内部のスタック（モジュール変数）で積み順を管理し、Escape は**最前面の 1 つだけ**が `onClose` する（設定画面の上にインポート画面を重ねても、1 回の Escape で両方が閉じない）。
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
- **`ContextMenu`** / **`ContextMenuItem`** / **`ContextMenuSeparator`** ([`src/components/ui/common/ContextMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/ContextMenu.tsx))
  - **概要**: 右クリックメニュー。指定座標に固定表示し、外側クリックで閉じる。項目は選択後に自動でメニューを閉じる（`role="menu"` / `menuitem`）。ツリー・レイヤーパネルのメニューはすべてこれを使うこと。
  - **主要Props**: `ContextMenu`: `x`, `y`, `onClose` / `ContextMenuItem`: `icon`, `onSelect`, `tone` (`default` | `danger`), `emphasis` (`normal` | `strong`)
- **`TextDiffView`** ([`src/components/ui/common/TextDiffView.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/TextDiffView.tsx))
  - **概要**: 行単位の差分（`utils/diff/lineDiff.ts` の `DiffLine[]`）を、追加（緑）・削除（赤）で色分けして表示する。変更行の前後だけを残し、それ以外の変更なし行は「N lines unchanged」に畳む。`role="group"` で `aria-label` を持つ。
  - **主要Props**: `lines`, `contextLines`, `aria-label`
- **`ItemDiffList`** ([`src/components/ui/common/ItemDiffList.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/ItemDiffList.tsx))
  - **概要**: 項目ごとの差分（New / Changed / Only here / Same）を一覧し、取り込む項目をチェックボックスで選ぶ汎用リスト。変更のある行は展開すると `TextDiffView` で行差分が見られる。変更の無い行は既定で隠し、チェックもできない。「Select all / Clear」付き。ドメインには依存せず、行は呼び出し側が `ItemDiffRow`（`id` / `label` / `status` / `lines` / `actionLabel`）で渡す（インポート画面では `modals/import/diffRows.ts` が作る）。
  - **主要Props**: `rows`, `accepted`（チェックされた行の id 集合）, `onChange`, `statusLabels`

### 共通 Hooks (`src/hooks/`)
- **`useClickOutside(ref, onOutside, enabled?)`**: 要素の外側でマウスが押されたときにコールバック（ドロップダウン・メニューのクローズ）。
- **`useTreeInteractionState()`**: WaypointTree / AnnotationTree 共通の DnD センサー、展開集合、インライン編集 ID、ドラッグ中 ID、コンテキストメニュー状態。
- **`useExportPlan({ isOpen, onClose })`** (`ui/modals/useExportPlan.ts`): ExportModal のプロファイル/項目編集（ドラフト。保存操作でストアへ反映）、ファイルプレビュー、衝突チェック、エクスポート実行。
- **`PluginCard`** (`ui/settings/PluginCard.tsx`): PluginsTab の 1 プラグイン分（有効化・並び替え・アイコン・インタプリタ上書き・SDK/依存状態）。**`ManualLayerTools`** (`ui/properties/ManualLayerTools.tsx`): 手動ベクターレイヤーの描画ツール・塗り種別・描画オブジェクト一覧。
- **`useTreeItemSelection`** / **`useTreeReveal`**: ツリーのクリック・Shift 範囲選択、および選択要素までの自動展開・スクロール。
- **`useResponsiveContainer`**: コンテナ幅に応じたレスポンシブ表示切り替え。


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
  - **概要**: プロジェクトで定義された Schema（速度、モード等）に基づき動的生成されるプロパティ入力群。全ての型の値編集を `OptionValueEditor` に委譲する。`resolveOptionsSchema` で ref を解決した実効スキーマを使い、行の key にノード ID を含めて選択切替時に確実に remount する。複数選択時はスカラーを一括設定でき、複合型は「個別に編集してください」と表示する。
  - **主要Props**: `isMultiSelection`, `node`, `handleUpdate`
- **`OptionValueEditor`** ([`src/components/ui/properties/OptionValueEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/OptionValueEditor.tsx))
  - **概要**: Option Schema の `TypeSpec` に従って値を再帰的に編集するコンポーネント（`CustomOptionsGroup` / `AnnotationCustomOptionsGroup`、および設定画面の `FieldEditor`（既定値・グローバル値の編集）が共用）。`list` は要素の追加・削除・並べ替え（構造体要素はカード、スカラー要素は行ごとの入力 + カンマ区切り貼り付け）、`object` は固定フィールド入力、`map` はキーの追加・リネーム・削除、`union` はバリアント選択（`switchUnionVariant` で同名フィールドを引き継ぐ）+ フィールド入力、`any` は JSON テキスト編集を行う。値が明示的に設定されているフィールドには「既定値に戻す」ボタンを、未設定のフィールドには「既定」バッジを表示する（`showResetControl` で無効化可）。`spec.presets` が1件以上あれば、型別コントロールの上にプリセット選択（`PresetSelector`）を出す。参照中は下のコントロールを読み取り専用にし、「カスタム値」への切り替えで参照先の値をコピーして編集を続けられる（`preset_only` では「カスタム値」自体を出さない）。カスタム値がいずれかのプリセットと完全に一致すれば「参照にする」を提示する。複数選択（`mixed`）でも、複合型を含めプリセット選択自体は出し、選択中の全ノードへ一括設定できる。 `defaultGlobal`（既定値が連動しているグローバル名）を受け取り、未設定時の「既定: 値（グローバル name）」表示に出所を添える。boolean は未設定時にチェックボックスの横へ同じ表示を出す。`ValueEditTransactionContext`（既定は no-op）経由で Undo/Redo トランザクションの実装を注入でき、Inspector はストアの `historySlice` と連動した実装を providing する。構造を変える操作は1回のトランザクションにまとめ、テキスト入力は focus/blur でトランザクションの開始・終了を行う。
  - **主要Props**: `spec`, `value`, `onChange`, `name`, `defaultValue`, `disabled`, `mixed`, `showResetControl`
- **`GeneratorNodePanel`** ([`src/components/ui/properties/GeneratorNodePanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/GeneratorNodePanel.tsx))
  - **概要**: 生成されたジェネレーターノードの再編集・引数調整・Waypoint展開 (Explode) を行うUI。
  - **主要Props**: `nodeId`
- **`CustomLayerInspector`** ([`src/components/ui/properties/CustomLayerInspector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/CustomLayerInspector.tsx))
  - **概要**: 手動ベクター描画レイヤー（直線・矩形・円形・ブラシ）のツール設定や、プラグイン生成マップレイヤーの新規作成・パラメータ編集・再生成・透過度・ブレンドモード調整を行う統合インスペクターUI。
  - **主要Props**: なし（`appStore` の `activeCustomLayerId` と連動）
- **`AnnotationInspector`** ([`src/components/ui/properties/AnnotationInspector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/AnnotationInspector.tsx))
  - **概要**: 選択中のアノテーションオブジェクト（Point, OrientedPoint, Line, Rect, Circle）の名前・カラー・表示トグル・各幾何座標（位置、サイズ、角度、半径等）を編集するインスペクターUI。
  - **主要Props**: なし（`appStore` の `selectedAnnotationIds` と連動）
- **`NewCustomLayerModal`** ([`src/components/ui/modals/NewCustomLayerModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/NewCustomLayerModal.tsx))
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
- **`InlineNameInput`** ([`src/components/ui/common/InlineNameInput.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/InlineNameInput.tsx))
  - **概要**: ツリー行などのインライン名前変更入力。編集中のみマウントし、Enter/blur で確定、Escape で取消。空・未変更は取消扱い。
  - **主要Props**: `name`, `onRename`, `onCancel`, `className`
- **`InternalPropertiesSection`** ([`src/components/ui/properties/InternalPropertiesSection.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/InternalPropertiesSection.tsx))
  - **概要**: プラグイン生成要素の `plugin_data` を読み取り専用で表示し、全画面ダイアログ (`openPluginDataModal`) を開く「内部プロパティ」セクション。GeneratorNodePanel / CustomLayerInspector / AnnotationInspector / AnnotationGroupPanel で共用。
  - **主要Props**: `data`, `viewerTitle`, `modalTitle`, `modalSubtitle`, `hideWhenEmpty`


---

## 3. アプリケーション機能パネル & モーダル (`src/components/ui/`)

- **`TopMenu`** ([`src/components/ui/shell/TopMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/TopMenu.tsx))
  - **概要**: アプリケーション最上部のメニューバー (File, Edit, View, Help)、中央のプロジェクト名表示・未保存状態（`isDirty`）インジケータバッジ、およびウィンドウ操作コントロール。
  - **主要Props**: なし
- **`PathRouterMenu`** ([`src/components/ui/shell/PathRouterMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/PathRouterMenu.tsx))
  - **概要**: トップバーに配置されるパス計算アルゴリズム選択、パラメータ設定、自動再計算トグル用ドロップダウンメニュー。
  - **主要Props**: なし
- **`ToolPanel`** ([`src/components/ui/shell/ToolPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/ToolPanel.tsx))
  - **概要**: 画面左端に配置されるメインツール切り替えバー (Select, Add Waypoint, Export Region, Import/Export/Settings等)。
  - **主要Props**: なし
- **`LayerPanel`** ([`src/components/ui/layers/LayerPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/layers/LayerPanel.tsx))
  - **概要**: マップレイヤー (`ProjectMapLayer`)、ベクター図形/プラグイン生成レイヤー (`CustomLayer`)、エクスポート領域 (`ExportRegion`) を一元管理するパネル。マップとカスタムレイヤーは `layerOrder` に従う 1 本の「Layers」リストに並び、上下ボタンで種類をまたいで並べ替えできる。共通シェル構造（`LayerCardShell`）により各カードのヘッダー・操作系をコンパクトかつ統一感高く配置。エクスポートレギオンセクションは開閉トグル（アコーディオン）と登録数バッジを備え、必要時のみ展開して編集可能。
  - **構成ファイル** (`ui/layers/`): `LayerCardShell`（カード枠・ヘッダー共通部）, `MapLayerCard`（ROS マップ：名前（ダブルクリック/右クリックで変更）・複製・姿勢/閾値（同じマップの全複製で共有）・不透明度・ブレンド・使用領域）, `MapClipEditor`（使用領域：オン/オフ、キャンバス上でのドラッグ描画（Draw on canvas）、左右上下の半分プリセット、矩形の X/Y/W/H 入力と追加/削除）, `CustomLayerCard`, `RegionCard`, `GeoMapCard`（背景地図：ベースマップ切替・不透明度・原点・オフセット/回転・「Align on canvas」）, `GeoOriginFields`（原点の緯度経度/UTM 入力）, `LayerVisibilitySetBar`（レイヤー表示セット：プルダウンで選ぶと適用。新規保存・現在の表示での更新・名前変更・削除。保存後に追加されたレイヤーがあるセットは「(needs update)」、適用後に手で表示を変えたセットは「(modified)」と表示し、前者は警告バナーから更新できる。レイヤーが 1 つもないときは表示しない）
- **`GeoAttribution`** ([`src/components/ui/overlays/GeoAttribution.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/overlays/GeoAttribution.tsx))
  - **概要**: 背景地図の表示中に、選択中のベースマップの帰属表示（例: © OpenStreetMap contributors）をキャンバス右下へ表示する。
  - **主要Props**: なし
- **ツリー部品** (`ui/trees/`): `WaypointTree` / `AnnotationTree` 本体と、行コンポーネント `WaypointTreeRow` / `AnnotationTreeRow`、挿入位置バー `InsertionBarItem`
- **プラグイン入力フォーム** (`ui/plugins/`): `PluginInputEditor` が入力種別ごとに `PointInputForm` / `PointsListInputForm` / `RectangleInputForm` / `WaypointSelectInputForm` / `AnnotationSelectInputForm` / `CustomLayerSelectInputForm` を切り替える
- **条件付き書式** (`ui/settings/`): `ConditionalStylesTab` が `ConditionEditor`（ネスト可能な条件グループ）と `StyleOverrideEditor`（要素別スタイル上書き）を組み合わせる
  - **主要Props**: なし
- **`WaypointTreePanel`** ([`src/components/ui/trees/WaypointTreePanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/trees/WaypointTreePanel.tsx))
  - **概要**: ウェイポイントツリー (`WaypointTree`) を単独でフルハイト表示する専用パネルコンポーネント。
  - **主要Props**: なし
- **`AnnotationTreePanel`** ([`src/components/ui/trees/AnnotationTreePanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/trees/AnnotationTreePanel.tsx))
  - **概要**: アノテーション一覧 (`AnnotationTree`) を単独でフルハイト表示する専用パネルコンポーネント。
  - **主要Props**: なし
- **`ObjectsPanel`** ([`src/components/ui/trees/ObjectsPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/trees/ObjectsPanel.tsx))
  - **概要**: ウェイポイントツリー (`WaypointTree`) とアノテーション一覧 (`AnnotationTree`) を統合してホストするレガシー/互換用オブジェクトパネル。
  - **主要Props**: なし
- **`WaypointTree`** ([`src/components/ui/trees/WaypointTree.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/trees/WaypointTree.tsx))
  - **概要**: 全 Waypoint / ジェネレーター要素を階層表示・ドラッグ＆ドロップで並び替えるツリーペイン。Shiftキーによる範囲選択、不連続選択を含む複数ノードの一括ドラッグ並び替え（連続化配置 & DragOverlayによるスタックカード視覚表示）、右クリックコンテキストメニュー（単一/複数選択項目の一括複製・一括削除・アンカー設定・内部プロパティ表示・Explode）に対応。
  - **主要Props**: なし
- **`AnnotationTree`** ([`src/components/ui/trees/AnnotationTree.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/trees/AnnotationTree.tsx))
  - **概要**: アノテーションオブジェクトの一覧表示、ドラッグ＆ドロップ並び替え、可視性/ラベル表示トグル、削除、名前編集、複製、配置モード開始トリガーを提供するコンポーネント。
  - **主要Props**: なし
- **`PropertiesPanel`** ([`src/components/ui/properties/PropertiesPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/properties/PropertiesPanel.tsx))
  - **概要**: 現在選択されている Waypoint またはジェネレーターの属性を編集するインスペクター右ペイン。
  - **主要Props**: なし
- **`PluginListPanel`** ([`src/components/ui/plugins/PluginListPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/plugins/PluginListPanel.tsx))
  - **概要**: 利用可能なプラグイン（経路自動生成アルゴリズム）を一覧表示し、クリックで起動するサイドパネル。
  - **主要Props**: `onSelectPlugin`
- **`PluginParamsPanel`** ([`src/components/ui/plugins/PluginParamsPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/plugins/PluginParamsPanel.tsx))
  - **概要**: 選択中プラグインの実行パラメータ設定・インタラクション入力トリガーフォーム。
  - **主要Props**: `pluginId`
- **`PluginInputEditor`** ([`src/components/ui/plugins/PluginInputEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/plugins/PluginInputEditor.tsx))
  - **概要**: プラグインが必要とする入力（座標 `point`、点群 `points`、領域 `rectangle`、参照 `waypoint`、アノテーション `annotation`、カスタムレイヤー `custom_layer`）の定義・編集エディタ。
  - **主要Props**: `inputDef`, `value`, `onChange`
- **`ExportModal`** / **`ExportMapsModal`** ([`src/components/ui/modals/ExportModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/ExportModal.tsx))
  - **概要**: Handlebars/Jinja テンプレートによる Waypoint エクスポート画面、および切り出しマップ画像の単体エクスポートモーダル。`ExportModal` の編集はドラフトとして保持され、「保存のみ」「保存してエクスポート」でのみプロジェクトへ反映（キャンセル/Esc で破棄）。マップ出力の項目には、レイヤー表示セットの選択欄（`ExportVisibilitySetField`）があり、未選択なら現在の表示状態で出力する。パスパターンでは `{{set}}`（項目の表示セット名。未選択は `current`）が使える。
  - **主要Props**: `isOpen`, `onClose`
- **`ImportHubModal`** ([`src/components/ui/modals/import/ImportHubModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/import/ImportHubModal.tsx))
  - **概要**: あらゆるインポートの入口（左ツールバーの Import ボタン / File > Import... / Ctrl+I / ワークフローの `open_import_modal`）。最初に取り込む対象の種類（`importCategories.ts`）を選び、その種類の取り込み画面（パネル）へ進む。ヘッダーの「戻る」で種類の選択に戻れる。設定画面など別の場所からは `setImportModalOpen(true, category)` で種類を指定して選択を飛ばせる（`uiSlice.importModalCategory`。開くたびに初期化される）。
  - **構成ファイル** (`ui/modals/import/`): `WaypointImportPanel`（外部ファイルのウェイポイント。書式・フィールドマッピングを指定）, `OptionSchemaImportPanel`（スキーマファイル。項目単位の差分を見て採否を選ぶ。マージ結果は `validateSchema` で検証し、不正なら取り込めない）, `TemplateImportPanel`（`.wpt_template`。同名テンプレートがあれば内容の差分を見せ、上書き／別テンプレートとして追加を選ぶ）, `ProjectImportPanel` + `ProjectImportCategoryRow` + `useProjectImport`（他のプロジェクト `.wptroj` から、設定とデータをカテゴリ単位で選んで取り込む。設定は今のプロジェクトとの差分を見て採否を決め、データは新しい ID で追加する）, `LaunchImportPanels`（マップ・プラグイン。既存サービスにファイル選択から任せる）, `diffRows`（差分を `ItemDiffRow` にする関数）。
  - **主要Props**: `isOpen`, `onClose`
- **`SettingsModal`** ([`src/components/ui/modals/SettingsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/SettingsModal.tsx))
  - **概要**: アプリ設定ダイアログ。`GeneralTab`（Waypoint Index Start / Decimal Precision / Export Integers as Float（整数も float で出力。`ToggleSwitch`）/ Python パス）, `AppearanceTab`, `OptionSchemaTab`（Waypoint Options / Global Fields / Definitions の3セクション。行 UI は `optionSchema/FieldEditor` を共用）, `ConditionalStylesTab`, `RobotFootprintTab`, `ExportTemplatesTab`（テンプレートごとに Engine (`Handlebars`/`Jinja`) を選択できる。変数チップは Core / Global / Geo Origin（位置合わせ後のマップ原点 `geo.*`）/ Custom Options / Raw Options）, `PluginsTab` の7タブを保持。
  - **主要Props**: `isOpen`, `onClose`
- **`optionSchema/FieldEditor`** ([`src/components/ui/settings/optionSchema/FieldEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/FieldEditor.tsx))
  - **概要**: Option Schema の1フィールド分（Key/Label/Required/Description + 型仕様 + 既定値/値）を編集する行。`OptionSchemaTab` の Waypoint Options / Global Fields、および `FieldListEditor`/`VariantListEditor` から呼ばれる object のフィールド・union のバリアントフィールドで共用する。型仕様の編集自体は再帰的な `TypeSpecEditor` に委譲し、既定値/値は `OptionValueEditor` による型付き入力で編集する（CSV テキストは廃止）。`scope`（自身の `optionPresets.ts` 走査上の位置。例: `options.tolerance`）と `isAppliedAndUnchanged` は、そのまま `TypeSpecEditor`（延いては Presets パネル）へ渡す。
  - **主要Props**: `field`, `groupLabel`, `valueLabel`, `value`, `definitionNames`, `scope`, `isAppliedAndUnchanged`, `isDuplicateName`, `onChangeField`, `onChangeValue`, `onRemove`
- **`optionSchema/TypeSpecEditor`** ([`src/components/ui/settings/optionSchema/TypeSpecEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/TypeSpecEditor.tsx))
  - **概要**: 値の型仕様（`TypeSpec`）を再帰的に編集する。Type セレクトで `ref` を含む全種別を選べ、`list`/`object`/`map`/`union` はそれぞれ要素・フィールド・値型・バリアントを、同じ `TypeSpecEditor`/`FieldListEditor` で再帰的に編集するため、GUI 上のネストの深さに実質的な制限が無い。`string` の選択肢は `ChoicesEditor` で、`ref` は `definitionNames` からのセレクトで編集する。`ref` 以外の全型の末尾に `PresetListEditor` を出す。`scope` は再帰の各段で `optionPresets.ts` の走査と同じ形式（`.item`/`.value_type`/`.fields.<name>`/`.variants.<value>.fields.<name>`）に伸ばして渡す。
  - **主要Props**: `spec`, `onChange`, `definitionNames`, `fieldName`, `scope`, `isAppliedAndUnchanged`
- **`optionSchema/FieldListEditor`** ([`src/components/ui/settings/optionSchema/FieldListEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/FieldListEditor.tsx))
  - **概要**: `object` のフィールド一覧、または `union` の1バリアント分のフィールド一覧を編集する。各行は `FieldEditor` で、ネストする型に制限は無い。各フィールドの `scope` は `${parentScope}.fields.${name}`。
  - **主要Props**: `fields`, `onChange`, `definitionNames`, `parentScope`, `isAppliedAndUnchanged`, `addLabel`
- **`optionSchema/VariantListEditor`** ([`src/components/ui/settings/optionSchema/VariantListEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/VariantListEditor.tsx))
  - **概要**: `union` の判別キー (`discriminator`) に対する値ごとのバリアント一覧を編集する。バリアントの追加・削除・値/ラベルの編集、および各バリアントのフィールド一覧（`FieldListEditor`。`parentScope` に `.variants.<value>` を足して渡す）を持つ。
  - **主要Props**: `variants`, `onChange`, `definitionNames`, `parentScope`, `isAppliedAndUnchanged`
- **`optionSchema/DefinitionListEditor`** ([`src/components/ui/settings/optionSchema/DefinitionListEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/DefinitionListEditor.tsx))
  - **概要**: `OptionsSchema.definitions`（名前付き型定義）の一覧を編集する。各定義は Name/Label/Description + `TypeSpecEditor`（`scope: definitions.<name>`）で構成され、他のフィールドから `ref` で参照できる。
  - **主要Props**: `definitions`, `onChange`, `isAppliedAndUnchanged`
- **`optionSchema/PresetListEditor`** ([`src/components/ui/settings/optionSchema/PresetListEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/PresetListEditor.tsx))
  - **概要**: 型仕様が持つ `presets`（名前・ラベル・`OptionValueEditor` による型付きの値）の追加・編集・削除、および `preset_only` の切り替えを行う。`isAppliedAndUnchanged` のとき（Apply/Import 直後で未適用の編集が無いとき）だけ、ストアの `nodes`/`annotationObjects`/`globals` を `optionPresets.ts` の `countPresetUsages`/`replaceMatchingValuesWithPreset` と突き合わせ、`scope` ごとの使用件数と「一致する未参照の値」の件数を表示し、後者を1つの履歴トランザクションで参照へ一括置換するボタンを出す。
  - **主要Props**: `spec`, `onChange`, `scope`, `isAppliedAndUnchanged`
- **`optionSchema/ChoicesEditor`** ([`src/components/ui/settings/optionSchema/ChoicesEditor.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/optionSchema/ChoicesEditor.tsx))
  - **概要**: `string` 型の選択肢 (`enum_values`) をチップの追加・削除で編集する。既定値欄と紛らわしかった CSV テキスト入力を置き換えたもの。
  - **主要Props**: `values`, `onChange`, `fieldName`
- **`AppearanceTab`** ([`src/components/ui/settings/AppearanceTab.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/AppearanceTab.tsx))
  - **概要**: 外観・表示設定タブ。テーマモード（Light/Dark）、アクセントカラープリセット、マップ透過度、パス外観（色・透過度・幅同期）、ROS占有グリッド閾値（障害物・フリー・ネゲート）の設定を提供。
  - **主要Props**: なし
- **`ConditionalStylesTab`** ([`src/components/ui/settings/ConditionalStylesTab.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/ConditionalStylesTab.tsx))
  - **概要**: 条件付き書式（Conditional Styles）設定タブ。対象要素（Waypoint, Path, Footprint, Annotation）、ネスト可能なAND/OR条件グループ、スタイルオーバーライド（色、線幅、破線、形状、強制表示、寸法直接参照等）のCRUD、優先順位並び替え、JSONエクスポート/インポートを提供。
  - **主要Props**: なし
- **`RobotFootprintTab`** ([`src/components/ui/settings/RobotFootprintTab.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/RobotFootprintTab.tsx))
  - **概要**: ロボットのフットプリント（円形・矩形・多角形）の定義・寸法設定・ROS Nav2 形式テキスト入出力、およびリアルタイム SVG プレビュー。
  - **主要Props**: なし
- **`TabSectionHeader`** ([`src/components/ui/settings/TabSectionHeader.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/TabSectionHeader.tsx))
  - **概要**: 設定モーダル内の各設定タブ専用共通ヘッダー部品。タイトル、説明、アイコン、バッジ、右上アクションをサポート。
  - **主要Props**: `title`, `subtitle`, `icon`, `badge`, `actions`
- **`SettingsSection`** ([`src/components/ui/settings/SettingsSection.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/SettingsSection.tsx))
  - **概要**: 設定項目を論理的なグループにまとめるセクションカード部品。ヘッダー（タイトル、説明、アイコン、右上アクション）とコンテンツスロットを提供。
  - **主要Props**: `title`, `description`, `icon`, `actions`, `children`
- **`SettingsRow`** ([`src/components/ui/settings/SettingsRow.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/settings/SettingsRow.tsx))
  - **概要**: 左側ラベル・説明と右側コントロールを均一に配置する設定行部品。水平・垂直レイアウトをサポート。
  - **主要Props**: `label`, `labelRight`, `description`, `children`, `vertical`
- **`PathRouterMenu`** ([`src/components/ui/shell/PathRouterMenu.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/PathRouterMenu.tsx))
  - **概要**: トップバーに常駐するパス計算・ルーター設定ポップアップメニュー。経路補間アルゴリズム（直線 / Dijkstra等）の選択、パラメータ設定、自動再計算トグル、パス色・透過度・線幅・Footprint幅同期などの表示設定を提供。
  - **主要Props**: なし
- **`KeyboardShortcutsModal`** ([`src/components/ui/modals/KeyboardShortcutsModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/KeyboardShortcutsModal.tsx))
  - **概要**: 定義されているショートカットキー一覧を表示するヘルプダイアログ。
  - **主要Props**: `isOpen`, `onClose`
- **`WelcomeModal`** ([`src/components/ui/modals/WelcomeModal.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/modals/WelcomeModal.tsx))
  - **概要**: ツール起動時およびファイルメニューから呼び出せるプロジェクト選択・ウェルカム画面。新規作成、既存プロジェクトを開く、直近開いたプロジェクト一覧のロードを提供。
  - **主要Props**: `isOpen`, `onClose`
- **`ThemeInjector`** ([`src/components/ui/shell/ThemeInjector.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/ThemeInjector.tsx))
  - **概要**: `themeMode`（Linear Dark / Light）、アクセントテーマ用プリセット（`themePreset`: Indigo / Emerald / Ocean / Amber / Purple / Midnight）、および Custom UI（`customUiConfig.theme`）のカラープリセット・カスタムCSS変数・`color-scheme` を DOM の `:root` に注入し、アンマウント時にクリーンアップするインジェクターコンポーネント。
  - **主要Props**: なし
- **`WorkflowPanel`** ([`src/components/ui/workflow/WorkflowPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/workflow/WorkflowPanel.tsx))
  - **概要**: Custom UI モード時にステップバイステップの作業手順をガイドするワークフローパネル。各ステップのアクションボタン、簡易パラメータ、プラグイン入力フォームを表示。
  - **主要Props**: なし
- **`CustomHtmlPanel`** ([`src/components/ui/shell/CustomHtmlPanel.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/CustomHtmlPanel.tsx))
  - **概要**: 外部 HTML ファイルまたはインライン HTML を iframe 経由でパネル内に安全に描画し、PostMessage 経由でアプリ側アクションを呼び出すカスタムパネル。
  - **主要Props**: `tabDef`
- **`PanelRegistry`** ([`src/components/ui/shell/PanelRegistry.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/PanelRegistry.tsx))
  - **概要**: パネルタブID（`project`, `inspector`, `layers`, `plugins`, `workflow`, `custom_html` 等）から対応するパネルコンポーネントを動的に解決・レンダリングするレジストリモジュール。
  - **主要Props**: なし
- **`StatusBar`** ([`src/components/ui/shell/StatusBar.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/ui/shell/StatusBar.tsx))
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

### Canvas 描画スタック順序 (Render & Event Priority Hierarchy)
`MapCanvas.tsx` における WebGL コンテナの重なり順（背面から前面）およびポインターイベント優先順位は以下の通り厳格に規定されています（0 と 10 は機能が有効なときだけ描画）：
0. **`GeoTileLayer` (Geo Base Map)**: OSM / 衛星画像などの背景地図タイル（最背面）
1. **`LayerStack`** (`layers/LayerStack.tsx`, `label="layer-stack-group"`): マップレイヤー（`MapLayerSprite`）と手動ベクター／プラグイン生成カスタムレイヤーを `layerOrder` の順（下から上）に描画。エクスポート／占有プレビュー中はブレンド画像に置き換わり、参照レイヤーだけがその上に残る。編集ツールのプレビュー（`MapEditToolOverlay`）は最上位
2. **`GridLayer`**: 1m メッシュ等のワールドグリッド線
3. **`PathLayer`**: ウェイポイント間パス補間線・コリドー帯
4. **`FootprintLayer`**: ロボット形状フットプリント表示
5. **`AnnotationLayer`**: アノテーション図形（Point, Line, Rect, Circle等）
6. **`WaypointLayer`**: ウェイポイント矢印マーカー、ラベル、回転ハンドル
7. **`PluginLayer`**: プラグイン自動生成プレビューおよび Interaction Hints 視覚補助
8. **`ExportRegionLayer`**: マップ切り出しエクスポート枠
9. **`SnappingGuideLayer`**: 直交スナップガイド線および数値入力 HUD（最前面）
10. **`GeoAlignMarkerLayer`**: 背景地図の位置合わせ中だけ、地図の原点位置と東方向のマーカーを描画
11. **`MapClipEditLayer`**: マップの使用領域を編集中（`map_clip_edit`）だけ、対象レイヤーの領域を半透明の枠で描画し、各矩形の 8 つのリサイズハンドルを置く

### Canvas 補助モジュール (`src/components/canvas/`)
- **`MapLayerSprite`** (`MapLayerSprite.tsx`): 占有格子画像 1 枚を ROS 原点に合わせて描画し、占有ハイライトフィルタを適用。マップインスタンスに使用領域（`clip`）があるときは、ワールド座標の矩形和集合を Pixi マスク（`utils/clipMask.ts`）として適用する。
- **Hooks** (`canvas/hooks/`): `useTileTextures`（背景地図タイルの取得要求とテクスチャ共有キャッシュ）, `useGeoMapAlign`（背景地図のドラッグ位置合わせ）, `useMapClipEdit`（マップの使用領域のドラッグ描画・ハンドルでのリサイズ）, `useWindowSize`, `useCanvasTheme`（背景色・テーマ解決）, `useBlendedPreview`（エクスポート／占有プレビューのブレンド画像取得）, `useSnapping`, `useAnnotationEdit`, `useMapEdit*`（ツール別編集）
- **純粋関数** (`canvas/utils/`): `viewport`（screen⇔world 変換・フィット・ズーム）, `hitTest`（矩形入力ハンドル判定・計測スナップ）, `canvasTheme`（フォールバックグリッド配色）, `labelLayout`（ラベル配置）, `tileCache`（タイルの同時取得数制限・LRU・失敗時の再試行間隔）

### Canvas レイヤー & フィルター群 (`src/components/canvas/`)
- **`OccupancyHighlightFilter`** ([`src/components/canvas/filters/OccupancyHighlightFilter.ts`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/filters/OccupancyHighlightFilter.ts))
  - **概要**: マップ画像を 2D Occupancy Grid の 3 領域（Obstacle: 赤, Free: 緑, Unknown: 紫）にリアルタイム色分けする PixiJS GPU GLSL シェーダーフィルター。
- **`GeoTileLayer`** ([`src/components/canvas/layers/GeoTileLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/GeoTileLayer.tsx))
  - **概要**: 背景地図（OSM / 衛星画像 / カスタム URL）のタイルを、原点・位置合わせ（オフセット/回転）を反映したワールド座標へ配置して最背面に描画。表示範囲と画面解像度からズームを選び、未取得タイルは取得済みの親タイルで代用する。
  - **主要Props**: `scale`, `position`
- **`GeoAlignMarkerLayer`** ([`src/components/canvas/layers/GeoAlignMarkerLayer.tsx`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/layers/GeoAlignMarkerLayer.tsx))
  - **概要**: `geo_map_align` モード中に、背景地図の原点位置（回転の軸）と地図の東方向を示すマーカーを描画。
  - **主要Props**: `scale`
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
  - **概要**: 全状態とアクション（`nodeSlice`, `mapSlice`, `pluginSlice`, `pathCalculatorSlice`, `projectSlice`, `uiSlice` ほか）を提供するメインフック。
- **Services** (`src/services/`): ストアと API を組み合わせるユースケース
  - `notify`（`notify` / `notifyError` / `confirmAction`：`alert`/`confirm` の代替）, `projectGuard`（未保存変更の破棄確認）, `pluginImport`（プラグインのフォルダ取込・雛形作成）, `importFiles`（インポート対象ファイルの選択と、スキーマ・テンプレート・プロジェクトの読み込み時の検証・正規化。`ImportFileError` はそのまま利用者に見せてよい）, `optionSchemaApply`（スキーマの検証・正規化・消えたプリセットの値への展開・適用。設定画面の Apply とインポートが共用）, `templateImport`（テンプレートの上書き／追加）, `projectImport`（取り込み計画の適用。スキーマを先に適用し、断られたら何も変えない）, `mapImport`（ファイルを選んでマップレイヤーとして追加。レイヤーパネル・ワークフロー・インポートが共用）, `mapRasterize`（レイヤーのラスタライズ）, `workflowActions`（カスタム UI ワークフロー）
- **API アダプタ** (`src/api/`): `BackendAPI`（Tauri IPC）, `DialogAPI`（ファイル／確認／メッセージダイアログ）, `AppAPI`（バージョン・終了・ウィンドウ操作）。いずれも jsdom / ブラウザでは Mock 実装に自動切替。
- **プラグイン出力・設定の純粋関数** (`src/utils/`): `pluginResult`（出力の正規化）, `pluginBindings`（パイプラインのバインディング解決）, `pluginRegistry`（カスタムプラグイン登録）, `pythonPath`（インタプリタ解決）, `exportPackage`（エクスポート要求の構築）, `footprint`（フットプリント幅）
- **背景地図の純粋関数** (`src/utils/geo/`): `utm`（WGS84 ⇔ UTM）, `webMercator`（XYZ タイル座標・ズーム選択）, `geoTransform`（緯度経度 ⇔ ワールド座標・タイル配置・表示タイル列挙・エクスポート用のマップ原点 `mapOriginGeo`）, `basemapPresets`（OSM / Esri 衛星 / 地理院 / カスタムのプリセットとタイル URL 生成）, `alignDrag`（ドラッグによる移動・回転量の算出）
- **差分・取り込みの純粋関数** (`src/utils/diff/`, `src/utils/import/`): `diff/lineDiff`（行単位の LCS 差分・変更の前後だけを残す折りたたみ）, `diff/itemDiff`（キーで突き合わせた項目単位の差分 `diffByKey`・キー順に依存しない表示用テキスト）, `import/optionSchemaMerge`（スキーマを options / globals / definitions の項目名で突き合わせ、採否に応じてマージ）, `import/idRemap`（取り込むデータの ID 振り直しと、子・親・ソース・レイヤー順・表示セット・実行 ID の参照の付け替え）, `import/projectImportPlan`（取り込みカテゴリの定義・テンプレート／プロファイルの突き合わせ・取り込み計画 `buildProjectImportPlan`）
- **`transformUtils`** ([`src/utils/transformUtils.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/transformUtils.ts))
  - **概要**: Quaternion ⇔ Yaw 変換、アンカー点基準の相対座標算出演算関数群。
  - **主要関数**: `quaternionToYaw`, `yawToQuaternion`, `calculateAnchorRelativeTransform`
- **`conditionalStyles`** ([`src/utils/conditionalStyles.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/conditionalStyles.ts))
  - **概要**: マップ要素（Waypoint, Path, Footprint, Annotation）の属性・オプション値を評価し、オーバーレイスタイルをカスケーディング合成・描画する純粋関数群。プロパティパスは `options.navigation.is_through_point` のように `object` フィールドまで辿れる。
  - **主要関数**: `resolveWaypointConditionalStyle`, `resolvePathConditionalStyle`, `resolveFootprintConditionalStyle`, `resolveAnnotationConditionalStyle`, `evaluateConditionGroup`, `drawDashedLine`, `parseColorSafe`
- **`optionSchema`** ([`src/utils/optionSchema.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/optionSchema.ts))
  - **概要**: Option Schema（`OptionsSchema`）の正規化・ref 解決・検証・パス列挙。旧形式（`list` の `item_type` をフラットに持つ形）を現行の再帰形（`item: { type }`）へ変換する。`definitions`/`ref` の展開（`expandSchemaRefs`）と、スキーマのオブジェクト同一性でメモ化した展開結果の取得（`resolveOptionsSchema`）を提供する。保存・スキーマ編集は `ref` を保ったままの生スキーマで行い、値の表示・編集・条件付き書式評価・エクスポートは `resolveOptionsSchema` を経由した実効スキーマを使う。`resolveTypeSpec`/`coerceSpecDefaultsDeep`（内部）は `presets`/`preset_only` も ref 展開・型変換の対象に含める。`validateSchema` はプリセット名の重複・空欄、値の型不一致、値が別のプリセットを参照すること（連鎖）の禁止、`preset_only` なのにプリセットが0件、を検証する。 `applyGlobalDefaultLinks` は `default_global` を持つフィールドの `default` を参照先グローバルの現在値で上書きして実体化する（`normalizeOptionsSchema` の最後と `setOptionsSchema` から呼ばれる）ため、既定値を読む側は連動を意識しない。`validateSchema` は連動先グローバルの存在・型の妥当性・グローバル自身への指定禁止も検証する。`collectGlobalDefaultLinks` はグローバル名ごとの連動フィールド一覧を返す。設定画面の `FieldEditor` は `SchemaGlobalsContext`（編集中のグローバル一覧と連動一覧）を参照して「固定値 / グローバル変数に連動」の切り替えを出す。
  - **主要関数**: `normalizeOptionsSchema`, `normalizeTypeSpec`, `resolveTypeSpec`, `expandSchemaRefs`, `resolveOptionsSchema`, `validateSchema`, `listPropertyPaths`
- **`optionValues`** ([`src/utils/optionValues.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/optionValues.ts))
  - **概要**: `TypeSpec`/`FieldDef` に従った値の再帰的な変換・検証・既定値解決・生成・比較を行う純粋関数群。Option Schema の値まわり（インポートの型変換、Inspector の入力、キャンバスラベル、Generator の差分検出、エクスポートの `options`/`raw_options` 分離、エクスポート前の必須チェック）はすべてここに集約する。`validateField` は型検証に加えて `required`（値・既定値のいずれも無い場合はエラー）を見る。`resolvePresets` はプリセット参照 (`{ $preset: name }`) を、list/object/map/union の中に入れ子で現れるものも含めて再帰的に実際の値へ解決する。`resolveWithDefaults` は `resolvePresets` → 既定値の補完の順で解決する。
  - **主要関数**: `coerceValue`, `validateValue`, `validateField`, `resolveWithDefaults`, `resolvePresets`, `isPresetRef`, `findPresetByName`, `findMatchingPreset`, `createValue`, `createUnionVariantValue`, `switchUnionVariant`, `summarizeValue`, `deepEqual`, `toStoredValue`, `isValueValid`, `parseCsvList`
- **`optionPresets`** ([`src/utils/optionPresets.ts`](file:///home/chuson/develop/waypoint-tool/src/utils/optionPresets.ts))
  - **概要**: プリセット参照の使用状況の集計と一括置換のための、スキーマと値を並行して辿る純粋関数群。スキーマ上の位置は `scope` 文字列（例: `options.tolerance`, `definitions.action.variants.wait.fields.countdown_ms`）で表し、`ref` は参照先の `definitions` のスコープへ折りたたむ（同じ定義を複数箇所から参照していても使用件数・置換は1つのスコープに集約される）。`OptionSchemaTab`／`PresetListEditor` から使う。
  - **主要関数**: `countPresetUsages`, `usageCountFor`, `replaceMatchingValuesWithPreset`, `collectPresetScopes`, `inlineRemovedPresets`
