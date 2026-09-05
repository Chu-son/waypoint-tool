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
> - 対象ファイル例: `src/components/ui/KeyboardShortcutsModal.tsx`

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
- **`ui/`**: 画面を構成するUIコンポーネント全般
  - **`ui/common/`**: ボタン、入力欄、モーダルなど、汎用・再利用可能な純粋な表示要素。
  - **`ui/settings/`**: 設定画面（Option Schema, Export Templates, Plugins 等）に関するコンポーネント。
  - その他、各機能（プロパティパネル、プラグインリスト等）に特化したUIコンポーネント。

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
| **ユーザー設定永続化** | LocalStorage / Zustand persist | `src/stores/migrations/storageMigration.ts` | ・`persist` ミドルウェアに `version: STORAGE_VERSION` および `migrateStorage` を設定。<br>・設定項目の追加・変更時は旧ストレージデータの自動補完・型正規化を実装。 |
| **プラグイン通信** | `manifest.json`, IPC stdio JSON | `src/stores/slices/pluginSlice.ts` / Rust `plugins` | ・**追加のみ（Additive Only）の原則**: プラグインへ送る `context` は既存キーを変更せず、新情報は新キーとして追加。<br>・旧マニフェスト（`category` 等）は読み込み時に新仕様（`primary_output`）へ自動マッピング。<br>・出力結果は旧仕様（単一ウェイポイント配列）と新仕様（`PluginResult`）の両方を境界で判別・正規化。 |
| **外部入出力** | ROS Map, Waypoint Import, Handlebars Template | `src/utils/importUtils.ts`, `src/components/ui/ExportModal.tsx`, `src/utils/treeUtils.ts` | ・インポート時はカラム名・キー名揺れを推論アダプタで吸収。<br>・エクスポート用 Handlebars コンテキストには旧テンプレート互換用エイリアス（例: `node.name` と `node.label`）を維持・提供。 |
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



