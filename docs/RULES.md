# プロジェクト開発ルール・ガイドライン

このドキュメントは、本プロジェクトにおける開発上のルールやガイドラインをまとめたものです。
人間およびAIアシスタントの双方が、一貫した品質で開発を進められるように設計されています。

## 1. ショートカットキーの管理に関するルール

ショートカットキーの追加・変更・削除を行う場合は、以下のルールに必ず従ってください。

### 1.1 グローバルショートカットとローカルショートカットの分類

- **グローバルショートカット**: `src/components/common/ShortcutManager.tsx` で一元管理する
  - 例: プロジェクトの保存（`Ctrl+S`）、ツール切り替え（`V`, `P`）、全選択（`Ctrl+A`）など、アプリケーション全体で（特定のモーダルやペインに依存せず）常に有効であるべき操作。
  
- **ローカルショートカット**: 各コンポーネント内で個別に管理する
  - 例: 特定のモーダルが開いている時のみ有効な操作や、特定の入力コンポーネント内でのみ機能する操作など。これらは該当コンポーネント内でローカルのイベントリスナーとして管理し、他のショートカットと競合しないようにする。

### 1.2 Help画面（Shortcut一覧）の更新義務

> **【重要】**
> ショートカットキーを**追加・変更・削除**した場合は、**必ずユーザー向けのHelp（ショートカット一覧モーダル等）も合わせて修正してください。**
> - 対象ファイル例: `src/components/ui/modals/KeyboardShortcutsModal.tsx`

内部の実装（`ShortcutManager`等）だけを変更して、UI上の説明（Help）の更新を忘れることがないよう徹底してください。

---

## 2. ディレクトリ構成・コンポーネント分割ルール

本プロジェクトでは、`src/components/` 以下のコンポーネントを**役割ベース**で分割することを基本とします。既存の各コンポーネントの詳細一覧・配置カタログは [COMPONENT_CATALOG.md](./COMPONENT_CATALOG.md) を参照してください。

### 2.1 基本的なディレクトリ分類

新規コンポーネントを作成する際は、原則として以下の既存分類のいずれかに配置してください（詳細なプロジェクト構造は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照）。

- **`canvas/`**: 描画関連
  - `MapCanvas` など、マップ描画やWebGL/2Dコンテキストを扱うコアな描画コンポーネント。
- **`common/`**: UIを持たない、または特定のUIコンポーネント群に依存しないアプリケーション全体の共通機能
  - 例: `ShortcutManager` など。
- **`ui/`**: 画面を構成するUIコンポーネント全般。**`ui/` 直下にはファイルを置かず**、必ず以下のいずれかのサブディレクトリに配置する。
  - **`ui/common/`**: ボタン、入力欄、モーダル枠など、汎用・再利用可能な純粋な表示要素（2ファイル以上で共通利用）。
  - **`ui/shell/`**: アプリの外枠（TopMenu, ToolPanel, StatusBar, DockSide/DockRail/PanelRegistry, ThemeInjector 等）。
  - **`ui/modals/`**: モーダルダイアログ（Export, Import, Settings, Welcome, KeyboardShortcuts 等）。インポートは入口（`ImportHubModal`）と取り込み対象ごとのパネルから成るため、親名のサブディレクトリ `ui/modals/import/` に置く。
  - **`ui/trees/`**: 階層ツリー（WaypointTree, AnnotationTree とそのパネル）。共通のツリー部品は `ui/trees/core/`（`TreeView` / `TreeRow`）。
  - **`ui/layers/`**: レイヤーツリー（`LayerTree`）とパネル、エクスポート領域の一覧パネル。
  - **`ui/plugins/`**: プラグイン一覧・パラメータ・入力エディタ。
  - **`ui/overlays/`**: キャンバス上に重ねるフローティング UI（MapEdit, Measure, AnnotationEdit, ElementCopy）。
  - **`ui/properties/`**: 右ペインの Inspector（PropertiesPanel とその部品）。
  - **`ui/settings/`**: 設定画面（Option Schema, Export Templates, Plugins 等）のタブ。
  - **`ui/pipeline/`**, **`ui/workflow/`**: パイプライン実行 UI、カスタム UI ワークフロー。
  - 巨大コンポーネントを分割した子コンポーネントは、親と同じサブディレクトリ（または親名のサブディレクトリ）に置く。

### 2.2 新規機能追加時の例外

新しい機能を追加する際は、可能な限り上記の基本分類に収めてください。
ただし、**大きく独立した機能**（例: 高度なエクスポート機能、特殊なインポート機能など）を追加する場合は、特例として**新規ディレクトリ（例：`export/`）の作成を許容**します。
無闇にトップレベルのディレクトリを増やすことは避けてください。

---

## 3. プロジェクト全体の後方互換性（Backward Compatibility）に関するルール

本プロジェクトでは、将来的な機能拡張や仕様変更に伴うデータ破壊・ランタイムクラッシュ、および「後方互換コードが各所に散乱して見通しを下げる」事態を防ぐため、以下のルールを厳格に遵守してください。

### 3.1 境界隔離の原則（Anti-Corruption Layer / Ingress Pipeline）

- **ドメインコア（内部ロジック）純粋化の原則**:
  外部から入力されるすべてのデータ（プロジェクトファイル、LocalStorage、プラグイン通信、外部インポートファイル、IPCメッセージ）は、**必ず各エントリポイントの境界（Migration / Adapter 層）で最新の正規化スキーマへ変換してからドメインコアへ渡さなければなりません。**
- **内部コードでの互換フォールバック記述の禁止**:
  各 Zustand スライス（`projectSlice`, `mapSlice` 等）、React コンポーネント、Canvas レイヤーの内部で、過去バージョンの互換性維持を目的としたフォールバック処理（例: `data.foo || data.legacy_foo || defaultValue` や `data.bar ?? defaultBar`）を直接記述してはなりません。
  内部コードは常に「最新かつ完全に正規化されたデータ型（Strict型）」が渡されている前提で簡潔に記述してください。

### 3.2 領域別の後方互換実装ルール＆チェックリスト

| 領域 | 対象 | 境界アダプタ / マイグレータ | 遵守ルール |
|---|---|---|---|
| **プロジェクトファイル** | `.wptroj` | `src/stores/migrations/projectMigration.ts` | ・`migrateAndNormalizeProjectData` で v0 から v1 への昇格と全必須フィールドのデフォルト補完。<br>・Rust側は `serde_json::Value` で完全透過。<br>・保存時は `buildProjectData` により常に最新形式（StrictProjectData / version: 1）で書き出し。 |
| **ユーザー設定永続化** | `app_config_dir/settings.json` / Zustand persist | `src/stores/migrations/storageMigration.ts`, `src/stores/persistence/settingsStorage.ts` | ・`persist` ミドルウェアに `version: STORAGE_VERSION` および `migrateStorage` を設定。<br>・設定項目の追加・変更時は旧ストレージデータの自動補完・型正規化を実装。<br>・**`migrateStorage` は冪等にする**（同じ入力を何度通しても結果が変わらない）。dev / AppImage / Docker が同じファイルを共有するため、新旧のビルドが交互に読み書きする。<br>・保存先は WebView の localStorage ではなくファイル（起動方式に依らず共有するため）。localStorage を新たな永続化先として使わない。 |
| **プラグイン通信** | `manifest.json`, IPC stdio JSON | `src/stores/slices/pluginSlice.ts` / Rust `plugins` | ・**追加のみ（Additive Only）の原則**: プラグインへ送る `context` は既存キーを変更せず、新情報は新キーとして追加。<br>・旧マニフェスト（`category` 等）は読み込み時に新仕様（`primary_output`）へ自動マッピング。<br>・出力結果は旧仕様（単一ウェイポイント配列）と新仕様（`PluginResult`）の両方を境界で判別・正規化。 |
| **外部入出力** | ROS Map, Waypoint Import, Handlebars Template | `src/utils/importUtils.ts`, `src/components/ui/modals/ExportModal.tsx`, `src/utils/treeUtils.ts` | ・インポート時はカラム名・キー名揺れを推論アダプタで吸収。<br>・エクスポート用 Handlebars コンテキストには旧テンプレート互換用エイリアス（例: `node.name` と `node.label`）を維持・提供。 |
| **ストアアクション** | `src/stores/slices/*.ts` | アクション定義部 | ・引数の拡張は**オプション引数オブジェクト化（`options?: { ... }`）**を推奨。<br>・シグネチャ変更時は旧関数を即時削除せず、`@deprecated` を付与したラッパーとして一時維持。 |
| **操作体系・ショートカット** | `ShortcutManager.tsx` | キーイベントディスパッチャ | ・既存ショートカットの破壊的変更時はエイリアスキーを提供。<br>・ショートカット変更時は本ガイド 1.2 項に従い `KeyboardShortcutsModal.tsx` を必ず同期更新。 |

### 3.3 プロジェクト設定・永続化対象の新機能を追加する際の手順

プロジェクトファイルに保存すべき新規プロパティや設定を追加する場合は、以下の順序で実装を行ってください。

1. **具象型定義の更新 (`src/types/store.ts`)**:
   - `ProjectData`（外部受取用・オプショナル）に新プロパティを追加。
   - `StrictProjectData`（内部標準・保存用）に新プロパティを必須（具象型）として追加。
2. **保存処理への追加 (`src/stores/slices/projectSlice.ts`)**:
   - `buildProjectData(state: AppState): StrictProjectData` 内に新プロパティの書き出しを追加。TypeScript のコンパイルチェックにより、未保存プロパティが存在する場合は型エラーで検知されます。
3. **マイグレーション・デフォルト値の定義 (`src/stores/migrations/projectMigration.ts`)**:
   - デフォルト値定数を定義・エクスポート。
   - `migrateV0ToV1`（または必要に応じて新バージョンマイグレータ）で、旧データに対するフォールバック・デフォルト値補完を実装。
   - falsy な値（数値 `0` や `false`）を `||` でデフォルト値に上書きしてしまわないよう、`??` または型チェックを用いて厳密にハンドリングすること。
4. **ストア初期化・リセット処理の更新 (`src/stores/slices/projectSlice.ts`)**:
   - `resetProject()` に新プロパティのリセット処理を追加。
5. **テストの追従・検証**:
   - `src/stores/migrations/projectMigration.test.ts` に旧データからの復元テストを追加。
   - `src/stores/slices/projectPersistence.test.ts` のラウンドトリップテストに新プロパティを追加。

### 3.4 非推奨（Deprecation）ライフサイクルと廃止手順

互換コードが無限に蓄積してコードベースが肥大化することを防ぐため、以下の段階的廃止フローに従ってください。

1. **Phase 1: 非推奨化（Deprecated）**
   - 旧プロパティや旧アクションに JSDoc の `@deprecated` タグを付与し、移行先を明記。
   - 境界アダプタで新形式へ自動変換。開発ビルド時のみ `console.warn` で開発者へ通知。
2. **Phase 2: 移行猶予（Grace Period / Sunset）**
   - マイナーバージョンアップ期間（または最低3ヶ月間）は互換アダプタを維持。
   - ゴールデンテスト（旧形式データ読込テスト）で回帰を防止。
3. **Phase 3: 廃止（Removed）**
   - 次期メジャーバージョンアップ（例: v2.0）時に旧互換コード・アダプタを安全に削除。
   - ドキュメントおよびテストを更新。

---

## 4. ストアミューテーションおよび安全規約 (Store Mutation & Safety Rules)

### 4.1 Direct setState 禁止原則 (No Direct setState Rule)
- コンポーネントやイベントリスナー（`ShortcutManager.tsx` 等）から `useAppStore.setState` を直接呼び出して状態を変更することを厳禁とする。
- すべての状態変更は、事前検証（バリデーション）と関連状態クリーンアップ（例: ツール切り替え時の編集モード解除など）をカプセル化した Store スライスのアクション（`setActiveTool`, `selectNodes` 等）を経由しなければならない。

### 4.2 破壊的操作ガード規約 (Destructive Operation Guard Pattern)
- `resetProject()`, `loadProject()` など、現在のプロジェクト状態を初期化・破棄するすべてのアクションは、UI 側の個別ダイアログに依存せず、ドメイン境界で `isDirty` を評価する統一ガード機構（`confirmDiscardChanges`）を通すことを義務付ける。
- キーボードショートカット（`Ctrl+N`, `Ctrl+O`）であっても、このガードをバイパスしてはならない。

### 4.3 履歴スナップショット一元管理原則 (History Snapshot Rule)
- `pushHistorySnapshot()` の呼び出しを UI コンポーネントや描画 Hook（`useMapEdit*.ts` 等）内で行うことを禁止する。
- ユーザー操作によるドメインデータ変更はすべて Store アクション内に閉じ、Store アクション側で原子的（Atomic）に履歴スナップショットを記録する。

---

## 5. 状態遷移・モード管理および選択権限規約 (State Transition & Selection Rules)

状態の組み合わせ爆発を防ぎ、決定論的な操作性を保証するため、以下の規約を厳格に遵守してください（詳細仕様は 📖 [STATE_MACHINE.md](./STATE_MACHINE.md) を参照）。

### 5.1 プライマリモード完全排他律 (Mode Exclusivity Rule)
- **`AppModeState` の使用義務**:
  モードの切り替えは、必ず `useAppStore.getState().transitionToMode(...)` を経由して行わなければならない。
- **独立ブール値によるモード管理の禁止**:
  コンポーネント内で独立したフラグ（`isEditing`, `isMapEditMode` 等）を直接 `setState` して独自のモード状態を作り出してはならない。
  すべての主要ツールモード（10種）は `AppModeState`（Discriminated Union）として単一化され、多重起動は型レベルで排除されなければならない。

### 5.2 選択ドメイン排他律 (Selection Domain Exclusivity Rule)
- **`setSelection` 経由の義務**:
  選択状態の変更は、必ず `useAppStore.getState().setSelection(...)` を使用すること。
- **複数ドメイン同時選択の禁止**:
  ウェイポイントノード（`selectedNodeIds`）とアノテーション（`selectedAnnotationIds`）やレイヤー（`ActiveSelection` の `layers`: マップ・カスタムレイヤー・グループの複数選択）を同時に選択状態にしてはならない。
  `ActiveSelection`（単一真実源）を介することで、別ドメインが選択された際は直前の選択IDが自動クリアされ、右ペインの Inspector 表示権が一意に保証される。

### 5.3 階層型エスケープ順序律 (Escape Hierarchy Ladder Rule)
- **`handleGlobalEscape` の遵守**:
  Escape キー入力によるキャンセル処理は、`src/stores/slices/interactionSlice.ts` の `handleGlobalEscape()` を唯一の窓口とし、数学的順序律（Tier 1〜Tier 7）に従って処理すること。
- **ローカルでの Escape 握りつぶし禁止**:
  個別の UI コンポーネントや Canvas イベントハンドラが `e.stopPropagation()` 等を用いて Escape キーイベントを無秩序に消費（握りつぶし）してはならない。
  局所的な過渡状態の中断は、後述の `registerCanvasAbortHandler` または DOM フォーカスの `blur()` を介してパイプラインから適切に起動されなければならない。
- **モーダルの Escape は最前面の 1 つだけ**:
  共通 `Modal` は開いているインスタンスの積み順を持ち、Escape には最前面の `Modal` だけが応答する（`stopPropagation` は使わない）。モーダルの上にモーダルを重ねる実装（設定画面 → インポート画面など）は、この仕組みに任せ、独自の Escape ハンドラを足してはならない。

### 5.4 過渡ジェスチャーのアトミック性とポインタ喪失保護 (Gesture Atomicity & Pointer Loss Protection Rule)
- **Abort ハンドラーの登録義務とロールバック保証**:
  キャンバス上でポインタの押下（PointerDown）から離脱（PointerUp）までにまたがるドラッグ、回転、描画などの過渡操作を実装する際は、必ず `registerCanvasAbortHandler` に中断ハンドラを登録しなければならない。
- **操作前座標への完全復元**:
  過渡ジェスチャー中に Escape キー等で中断された場合、未確定の座標変更は直前の初期状態（`initialTransforms` 等）へ原子的（Atomic）にロールバックし、作成途中の履歴スナップショット（ドラフト）は確実に破棄しなければならない。
- **ポインタ喪失イベント（`pointercancel`, `lostpointercapture`, `blur`）の捕捉**:
  OS通知やウィンドウ切替、タッチ操作等でポインタが喪失された場合、キャンバスは `abort()` を同期実行してドラッグ状態を解放し、ポインタのスタック（Sticky Mouse）を防止しなければならない。

### 5.5 単一トランジションチョークポイント原則 (Unified Transition Choke Point Rule)
- **`transitionToMode` 単一経由の義務**:
  モード遷移を発生させるすべてのコード（ツールバー、ショートカット、プラグイン対話、プロジェクト読込・リセット）は、例外なく `transitionToMode`（または `abortCanvasGestures`）を経由しなければならない。
- **OnExit での過渡ジェスチャー自動破棄**:
  モード遷移時は、OnExit フェーズにおいて進行中の過渡ジェスチャーが自動的に強制ロールバック（アボート）される。コンポーネント側で独自のクリーンアップコードを重複実装する必要はなく、ストアのチョークポイントに委譲すること。

---

## 6. 依存関係・肥大化防止規約 (Dependency & Size Rules)

### 6.1 層規約の遵守
- モジュール間の依存方向は [ARCHITECTURE.md §1.1](./ARCHITECTURE.md) の層規約（`types ← utils ← api ← services ← stores ← hooks ← components`）に従う。
- `utils/` には純粋関数のみを置く。ストア・React・DOM・PixiJS に依存する処理は `services/`・`hooks/`・`components/canvas/` に置く。
- コンポーネントは `@tauri-apps/*` を直接 import しない。ウィンドウ操作・バージョン取得等も `src/api` のアダプタを経由する。

### 6.2 ユーザー通知・確認
- `window.alert` / `window.confirm` を新たに使用しない（ESLint `no-alert`）。ユーザーへの通知・確認は `DialogAPI`（または `services/` の通知ヘルパー）を経由する。
- 結果が 3 つ（はい／いいえ／キャンセル）になる確認は `chooseAction`（`DialogAPI.choose`）を使い、ボタン名は選択肢の中身で付ける（「はい／いいえ」のままにしない）。キャンセルは何も変えない。
- 位置調整のように連続して発火する操作（微調整パッドの長押し・数値入力）の確認は、答え（続行）を覚えて 1 回だけ聞く。ダイアログが開いているあいだの繰り返しは捨て、キャンセルされたら長押しの残りも止める（`PoseAdjuster` の `onNudge` が `false` を返す）。

### 6.3 ストア購読
- 複数フィールドを購読する場合は `useShallow` でまとめ、不要な再レンダリングを避ける。ストア全体の購読（`useAppStore()` の引数なし呼び出し）は禁止。
- イベントハンドラ内での `useAppStore.getState()` 参照は許容する（描画に使う値は selector で購読する）。
- ドメインロジック（エクスポート実行、プラグインのインポート、マップ読込等）はコンポーネントに書かず、ストアアクション・`services/`・カスタム Hook に置く。

### 6.4 ファイルサイズの目安
- コンポーネントファイルが **400 行**、ストアスライスが **600 行** を超えたら分割を検討する。
- 分割の単位は「責務」。1 ファイル内に複数の独立したサブコンポーネント・フォーム・ハンドラ群がある場合は、サブコンポーネント・カスタム Hook・純粋関数に切り出す。
- 同じ UI パターン（コンテキストメニュー、click-outside、インラインリネーム、ツリー行など）が 2 箇所以上に現れたら `ui/common/` または `hooks/` に共通化する（[DESIGN_SYSTEM.md §7](./DESIGN_SYSTEM.md)）。

### 6.5 テスト
- テストは振る舞いを検証する。ストアのモック禁止、境界のみのモック、共通ヘルパーの利用など詳細は 📖 [TESTING.md](./TESTING.md) に従う。

---

## 7. ツリー操作の標準 (Tree Interaction Standard)

レイヤー・アノテーションなど、階層を持つ一覧は共通の `TreeView`（`src/components/ui/trees/core/`）で作り、操作を揃える。新しいツリーを作るときも、`TreeView` に載せて以下を満たす。ウェイポイントツリーは挿入位置を持つため例外（[ARCHITECTURE.md](./ARCHITECTURE.md) の「ウェイポイントツリー」を参照）だが、選択・リネーム・Alt+↑↓・グループ化は同じ操作にそろえる。

### 7.1 操作
| 操作 | 動作 |
|---|---|
| クリック / Ctrl+クリック / Shift+クリック | 単一選択 / 追加・解除 / 表示順の範囲選択（`useTreeItemSelection`） |
| ダブルクリック・F2 | 名前を変更（選択が 1 つのとき） |
| Alt+↑ / Alt+↓ | 選択（同じ親の下にあるもの）を、その親の中で 1 つ上・下へ。端で止まる（親の外へは出ない） |
| Ctrl+G / Ctrl+Shift+G | 選択をグループ化 / グループを解除（中身は残る）。`services/` のコマンド（`layerCommands.ts`・`annotationCommands.ts`）を通す |
| Delete・Backspace / Ctrl+D | 削除（中身のあるグループは確認する）/ 複製 |
| 右クリック | コンテキストメニュー。順序は「グループ化 → 名前を変更 → 解除 → 切り取り・コピー・貼り付け・複製 → 詳細 → 削除」 |
| ドラッグ&ドロップ | 前・後・中（下表） |

### 7.2 ドロップ（`computeDropTarget`）
- グループの行は、上 1/4 が「前」、下 1/4 が「後」、残りが「中」。グループ以外は上半分が「前」、下半分が「後」。
- 開いたグループの「後」は、その子の先頭（真下の行）になる。
- グループの最後の行の「後」は、ポインタの横位置で外へ出る深さを選ぶ。`TREE_INDENT_PX`（10px）ごとに 1 段外へ出る。
- 自分自身・自分の子孫の中へは落とせない（`canDrop`）。入れ子は深さ 8 まで（`MAX_LAYER_GROUP_DEPTH`）。
- 閉じたグループの上に乗せ続けると開く。「中」は、レイヤーではグループの先頭、アノテーションでは末尾に入れる（アノテーションは積み順ではなく番号順のため）。

### 7.3 展開状態と選択
- 展開状態は `uiSlice.expandedTreeItems[treeId]` に持つ（既定は閉じる）。選択した項目の祖先は `TreeView` が自動で開く。閉じたグループが選択項目を含むときは、行に印を出す。
- ローカル状態にしない。`treeId` はツリーごとに固定の文字列（`'layers'`・`'annotations'`）。

### 7.4 表示の意味
- グループの目のボタンは、グループ自身のフラグだけを切り替え、**子の表示設定は書き換えない**。実効表示は「自分 AND 祖先すべて」（レイヤーは `layerTree.idsHiddenByGroups` と `layerVisibilitySets.effectiveLayerVisibility`、アノテーションは `annotationVisibility.isAnnotationShown`）。
- 描画・当たり判定・スナップ・エクスポートは、実効表示を使う。子の `visible` を直接読まない。祖先が非表示の行は「上のグループが非表示のため表示されていません」の印を出す。

### 7.5 状態の持ち方
- ツリーは 1 つの形（ルート ID の配列と、グループの `children_ids`）だけを持ち、積み順などはそこから導出する。平らな並びを別に持って同期しない（ずれの原因になる）。
- ツリーの変更（移動・グループ化・解除・削除）は純関数（`layerTree.ts`・`treeOps.ts`）で行い、ストアのアクションは結果を 1 回の履歴スナップショットにして反映する。
- リファクタリングの前に対象の振る舞いテストを用意し、テストが通る状態を保ったまま進める。
