# プラグイン開発ガイド (Plugin Guide)

ROS Waypoint Tool は、外部スクリプト（Python / WASM）をプラグインとして呼び出すことで、独自の経路生成アルゴリズム（ジェネレーター）を追加できます。

## 1. アーキテクチャ

ツール本体とプラグインは、OS の標準入出力 (stdin/stdout) を介して JSON 形式で通信します。これにより、プラグイン側で複雑な依存関係を持つ必要がなく、言語を問わず（標準的には Python) 実装が可能です。

## 2. 構造

各プラグインは以下の最小構成を持つディレクトリです。

```
my_plugin/
├── manifest.json   # メタデータとUIの定義
└── main.py         # 実際のロジック（実行ファイル）
```

## 3. manifest.json の定義

`manifest.json` では、プラグインの名前、入力方法、およびプロパティを定義します。

### 主なフィールド
### 主なフィールド
- `primary_output`: プラグインの主要出力タイプ（UIでの配置タブやフィルタに使用）。
  - `"waypoints"`: ウェイポイントを主に出力（デフォルト）。
  - `"custom_layer"`: カスタムレイヤー画像を主に出力（Map Layers タブ）。
  - `"annotations"`: アノテーショングループを主に出力（Annotations タブ）。
  - `"path_calculator"`: ウェイポイント間パス補間（Path Router メニュー）。
- `category`: 旧仕様互換カテゴリ（`"waypoint_generator"` | `"map_layer_generator"` | `"path_calculator"`）。
- `inputs`: キャンバス上での操作入力を定義。
  - `type: "point"`: 座標と向き（Yaw）をクリックで指定。
  - `type: "points"`: 複数座標のリスト（点群）。キャンバスクリックで追加、ドラッグで移動、右クリック/リスト操作で削除。
    - `min_points`: 最小点数（省略可）。
    - `max_points`: 最大点数（省略可、デフォルト 50）。
    - `allow_yaw`: 各点に向き（Yaw）を持たせるか（デフォルト `false`）。
  - `type: "rectangle"`: 範囲をドラッグで指定。
  - `type: "waypoint"`: 既存のウェイポイントを選択。プラグインには `{ id, name, transform, options }` の正規化ペイロードが渡されます（参照先ノードが削除されていた場合は `null` となり事前バリデーションで検知可能）。
  - `type: "annotation"`: プロジェクト内の参照用アノテーションオブジェクトを選択。
    - `object_type`: 受け付けたいアノテーションの種類（`"point"`, `"oriented_point"`, `"line"`, `"rect"`, `"circle"`, `"any"`。デフォルト `"any"`）。
    - `multiple`: 複数選択を許可するか（`true` の場合は配列、`false` の場合は単一オブジェクト）。
  - `type: "custom_layer"`: プロジェクト内のカスタムレイヤー（手動描画またはプラグイン生成レイヤー）を選択。
    - `multiple`: 複数選択を許可するか（`true` の場合はプルダウン選択＋追加リストUI、`false` の場合は単一選択プルダウン）。
- `legacy_ids`: 旧プラグインIDや旧クラス名（例: `["SweepOffsetLinesGenerator", "SweepGenerator"]`）のエイリアスリスト。プロジェクト読み込み時の互換解決に使用されます。
- `properties`: UI に表示されるパラメータ（数値、文字列、真偽値等）。
  - `interaction_hints`: キャンバス上にプレビュー図形を描画するためのヒント情報。
- `needs`: アプリ本体から追加情報（マップや選択中のポイントなど）を要求する場合に指定。現在サポートされている値は以下の通りです：
  - `"selected_points"`: ユーザーが選択している Waypoint の正規化された `Transform` オブジェクト配列（`[{ x, y, z, qx, qy, qz, qw }]`）を `context["selected_points"]` に注入します。Python SDK では `self.get_selected_points(context)` ヘルパー経由で `List[Point]` として取得可能です。
  - `"occupancy_grid"`: 現在表示されているマップ画像から占有格子データを生成し (`context["occupancy_grid"]`) 注入します。
  - `"occupancy_grid_in_region"`: `inputs` で指定した `rectangle` の範囲内のみの占有格子データを生成し注入します（全体を生成するより高速です）。
  - `"robot_footprint"`: プロジェクト設定で定義されたロボットの形状・寸法データ (`context["robot_footprint"]`) を注入します。

## 4. インタラクションヒント (Interaction Hints)

プラグイン側からキャンバス上の描画を制御するための仕組みです。プロパティにヒントを紐付けることで、コアコードの修正なしに視認性の高い UI を実現できます。

例: 走査の開始コーナーを指定するドロップダウンに対し、キャンバス上に「ここから開始します」という矢印を表示する。

## 5. Python SDK の利用

組み込みの `wpt_plugin` パッケージを利用することを推奨します。SDK には、座標計算を容易にする幾何学クラス、統合ジェネレーター基底クラス、および結果ビルダーが含まれています。

### 1) 統合ジェネレーター (`PluginGenerator` & `PluginResult`) - 推奨
`PluginGenerator` と `PluginResult` を使用すると、**ウェイポイント、カスタムレイヤー、アノテーション、および計算メタデータ（`plugin_data`）を同時に1回の実行で出力**できます。

```python
from wpt_plugin import PluginGenerator, PluginResult, Point

class MultiOutputSearchPlugin(PluginGenerator):
    def generate(self, context):
        res = PluginResult()
        
        # 1. ウェイポイントの生成・追加
        waypoints = [
            self.make_waypoint(0.0, 0.0, 0.0),
            self.make_waypoint(2.0, 0.0, 0.0),
            self.make_waypoint(2.0, 2.0, 1.57),
        ]
        res.add_waypoints(waypoints, name="Search Route", plugin_data={"total_length": 4.0})

        # 2. カスタムレイヤー（探索エリアマスク等）の追加
        mask = [[1 if (r + c) % 2 == 0 else 0 for c in range(50)] for r in range(50)]
        res.add_custom_layer(
            name="Explored Mask",
            mask=mask,
            origin=[0.0, 0.0, 0.0],
            resolution=0.05,
            color_rgba=(59, 130, 246, 150),
            plugin_data={"coverage_rate": 78.5}
        )

        # 3. アノテーション（危険領域や検索境界等）の追加
        res.add_annotations([
            self.make_annotation_rect(1.0, 1.0, 2.5, 2.5, name="Search Boundary", color="#ef4444"),
            self.make_annotation_point(0.0, 0.0, name="Base Point"),
        ], name="Boundary Annotations")

        # 4. 全体共通の内部データ (JSON Viewerで確認可能、他プラグインへ入力連携)
        res.set_plugin_data({
            "algorithm": "Grid Coverage Search v2",
            "estimated_time_sec": 120.5,
            "waypoints_count": len(waypoints)
        })

        return res

if __name__ == "__main__":
    MultiOutputSearchPlugin().run_from_stdin()
```

### 2) 従来形式のウェイポイント生成 (`WaypointGenerator` / リスト返却)
既存プラグインとの後方互換性も完全に維持されています。

```python
from wpt_plugin import WaypointGenerator, Point

class MyGenerator(WaypointGenerator):
    def generate(self, context):
        start = self.get_interaction_point(context, "start_point")
        if not start:
            return []

        count = self.get_property(context, "count", 5)
        spacing = self.get_property(context, "spacing", 1.0)

        points = []
        for i in range(count):
            p = Point(i * spacing, 0).to_world(start.x, start.y, start.yaw)
            points.append(self.make_waypoint(p.x, p.y, p.yaw))
            
        return points

if __name__ == "__main__":
    MyGenerator().run_from_stdin()
```

### 3) 従来形式のマップレイヤー生成 (`MapLayerGenerator`)
```python
from wpt_plugin import MapLayerGenerator, OccupancyGrid, Point

class DrivableAreaGenerator(MapLayerGenerator):
    def generate_layer(self, context):
        seeds = self.get_interaction_points(context, "seed_points") or [Point(0, 0)]
        grid = self.get_occupancy_grid(context)
        
        mask = [[1 if (r + c) % 2 == 0 else 0 for c in range(100)] for r in range(100)]
        return self.create_layer_from_mask(
            mask,
            origin=[-2.5, -2.5, 0.0],
            resolution=0.05,
            name="Drivable Area Layer",
            blend_mode="overwrite",
            color_rgba=(34, 197, 94, 160)
        )

if __name__ == "__main__":
    DrivableAreaGenerator().run_from_stdin()
```

### 4) パス計算 (`PathCalculator`)
ウェイポイント間をA*/ダイクストラ等のアルゴリズムで補間し、各区間のポリラインを出力します。
```python
from wpt_plugin import PathCalculator

class DijkstraCalculator(PathCalculator):
    # 基底クラスの calculate_path / find_segment_path / find_dijkstra_path を利用
    pass

if __name__ == "__main__":
    DijkstraCalculator().run_from_stdin()
```

### 5) 占有格子データ仕様とセマンティック API (`OccupancyGrid`)

アプリ本体からプラグインへ渡される占有格子データ (`context["occupancy_grid"]`) は、ROS 2 Nav2 標準に準拠した signed 8-bit (`int8`) 配列として zlib 圧縮・Base64 エンコードされて渡されます。

#### セルの値定義 (Cell Values Specification)
| 定数 | 値 | 意味 | 備考 |
| :--- | :--- | :--- | :--- |
| `grid.FREE` | `0` | **自由空間 (Free Space)** | 通行可能なエリア |
| `grid.OBSTACLE` | `100` | **障害物 (Obstacle)** | 衝突エリア（進入禁止） |
| `grid.UNKNOWN` | `-1` | **不明領域 (Unknown Space)** | 未計測エリア（プラグインの `allow_unknown` 設定に従う） |

#### セマンティック判定メソッド (Recommended APIs)
プラグイン開発者がセルの生数値を直接比較せず、意図を安全かつ可読性高く記述できるよう、以下のメソッドが提供されています：

```python
# ワールド座標 (x, y) での判定
grid.is_free(x, y)          # 自由空間であれば True
grid.is_obstacle(x, y)      # 障害物であれば True
grid.is_unknown(x, y)       # 不明領域（またはマップ範囲外）であれば True

# グリッドセル座標 (row, col) での判定
grid.is_free_cell(r, c)     # 自由空間であれば True
grid.is_obstacle_cell(r, c) # 障害物であれば True
grid.is_unknown_cell(r, c)  # 不明領域（または範囲外）であれば True

# 座標変換
col, row = grid.world_to_grid(x, y)
world_x, world_y = grid.grid_to_world(row, col)
```

### 6) プラグイン間データ連携 (`plugin_data` Pipeline)
他プラグインの出力結果（レイヤーやアノテーション）を入力として受け取った際、`self.get_plugin_data(obj)` ヘルパーで内部計算結果を取得できます。

```python
class PathFollowerPlugin(PluginGenerator):
    def generate(self, context):
        layer = self.get_custom_layer(context, "cost_layer")
        layer_data = self.get_plugin_data(layer)
        if layer_data:
            coverage = layer_data.get("coverage_rate", 0)
            self.log(f"Cost layer coverage: {coverage}%")
        ...
```

### 利用可能な幾何学クラス・ヘルパー
- `Point(x, y, yaw)`: 座標と向き。`to_world()` メソッドで変換可能。
- `Line(p1, p2)`: 線分。長さの取得や交点判定が可能。
- `Rectangle(center, width, height, yaw)`: 矩形。頂点の取得や点の内包判定が可能。
- `Circle(center, radius)`: 円形。点の内包判定が可能。
- `Ray(origin, yaw, bidirectional)`: 仮想無限線。線分や矩形との交点取得に便利。
- `RobotFootprint(type, radius, length, width, offset_x, offset_y, points)`: ロボットの形状・寸法。
- `OccupancyGrid(data)`: 占有格子マップクラス（ROS Nav2互換）。
- `PluginResult()`: 複数オブジェクト出力用ビルダー（`add_waypoints`, `add_custom_layer`, `add_annotations`, `set_plugin_data`）。
- `find_dijkstra_path(grid, start_pos, goal_pos, safety_margin, step_size)`: 障害物回避ダイクストラ / A*探索ヘルパー。
- `self.get_annotation(context, input_id)` / `self.get_annotations(context, input_id)`: アノテーション入力オブジェクトの取得ヘルパー。
- `self.get_custom_layer(context, input_id)` / `self.get_custom_layers(context, input_id)`: カスタムレイヤー入力データの取得ヘルパー。
- `self.get_plugin_data(obj)`: オブジェクト（レイヤー/アノテーション等）に紐付く `plugin_data` を安全に取得するヘルパー。
- `encode_rgba_to_png_base64(width, height, rgba_bytes)`: 純粋Pythonによる高速PNG Base64エンコーダー。
- `get_grid_backend()`: 最適な 2D 格子配列処理バックエンド (`NumpyGridBackend` / `PurePythonGridBackend`) を自動取得。
- `erode(grid, radius)` / `dilate(grid, radius)`: 円形構造要素によるモルフォロジー収縮・膨張ヘルパー。
- `distance_transform(grid)`: 高速ユークリッド距離変換 (EDT) ヘルパー。
- `gaussian_blur(grid, sigma)`: 分離可能 2D ガウシアン平滑化フィルタ。

## 6. プラグインの登録
1. アプリの Settings > Plugins タブを開きます。
2. 「Add Custom Plugin」をクリックし、プラグインディレクトリを選択します。
3. 自動的にリストに追加され、それぞれのカテゴリ（ジェネレーター、マップレイヤー生成、パス計算）に応じて利用可能になります。

---

## 7. プラグイン通信の後方互換性方針 (Backward Compatibility Policy)

プラグイン機構は外部プロセスと連携するため、ツール本体およびプラグイン双方のバージョン差異による破壊を防ぐ必要があります。

1. **コンテキスト注入の「追加のみ（Additive Only）の原則」**:
   - ツール本体からプラグインの `context` に渡されるデータは、既存キーの意味や型を変更してはなりません。新情報が必要な場合は常に新しいキーとして追加されます。
   - プラグイン側も `context.get("key", default_value)` を用いて安全にキーを参照してください。
2. **マニフェスト (`manifest.json`) の後方互換**:
   - `primary_output`（新仕様）未指定の旧マニフェストは、旧キー `category`（`"waypoint_generator"` 等）から自動推論されます。
   - 新しい入力型（`annotation`, `custom_layer`）はオプショナルであり、既存プラグインの `inputs` 定義を壊しません。
3. **出力形式の柔軟な受容**:
   - ツール本体は、旧来のリスト単体返却形式（`[ { "x": ..., "y": ... } ]`）と、新仕様の複数出力オブジェクト形式（`PluginResult`）の両方を境界で判別・受容します。

---

## 8. 共有ライブラリプラグイン (Shared Library Plugins: `type: "python_library"`)

複数のプラグインで共通して利用したい幾何学計算ルーチン、ロボット固有の運動学モデル、最適化アルゴリズムなどをパッケージ化し、他の実行可能プラグインから簡単に再利用できる仕組みです。

### 1) マニフェストの定義
共有ライブラリプラグインでは、`type` に `"python_library"` を指定し、`module_name` に Python インポート名（フォルダ名・モジュール識別子）を指定します。

```json
{
  "name": "Sample Shared Geometry Library",
  "version": "1.0.0",
  "type": "python_library",
  "module_name": "sample_geo_lib",
  "description": "多角形面積、軌道平滑化、累積距離計算などの共通計算を提供する共有ライブラリです。",
  "python_dependencies": []
}
```

### 2) ディレクトリ構成
プラグインディレクトリ内に、`module_name` と同名の Python パッケージディレクトリ（または単一 `.py` ファイル）を配置します。

```
sample_geo_lib/
├── manifest.json
└── sample_geo_lib/
    └── __init__.py      # polygon_area, smooth_trajectory などを実装
```

### 3) 自動 PYTHONPATH 注入と利用方法
Tauri バックエンドは、登録・スキャンされたすべての `python_library` プラグイン（または `module_name` を持つプラグイン）の配置パスを自動収集し、実行可能プラグインのプロセス起動時に OS 固有の区切り文字（Unix `:`, Windows `;`）で `PYTHONPATH` 環境変数へ注入します。

したがって、呼び出し側のプラグインスクリプト（`main.py`）では、**`sys.path.append(...)` のような壊れやすい相対パス操作を行わずに直接インポート**できます：

```python
# 各自のプラグイン内 main.py
from wpt_plugin import PluginGenerator, PluginResult
import sample_geo_lib  # 自動的に PYTHONPATH から解決されます

class AreaSurveyGenerator(PluginGenerator):
    def generate(self, context):
        polygon_pts = [(0.0, 0.0), (10.0, 0.0), (10.0, 8.0), (0.0, 8.0)]
        area = sample_geo_lib.polygon_area(polygon_pts)
        self.log(f"Survey polygon area: {area:.2f} m²")
        ...
```

---

## 9. 外部依存パッケージの管理と推奨設計パターン

プラグインが NumPy, SciPy, Shapely などの外部 Python ライブラリを必要とする場合、`manifest.json` の `python_dependencies` フィールドに宣言します。

### 1) `python_dependencies` の指定

```json
{
  "name": "Advanced Coverage Generator",
  "type": "python",
  "executable": "main.py",
  "python_dependencies": [
    {
      "name": "numpy",
      "version": ">=1.20.0",
      "optional": false,
      "description": "高速な 2D 占有格子データ処理および行列演算に必要です。"
    },
    {
      "name": "scipy",
      "optional": true,
      "description": "高速なモルフォロジー演算および距離変換のアクセラレーションに使用されます。"
    }
  ]
}
```

- `name`: PyPI パッケージ名。
- `version`: セマンティックバージョニング条件（`">=1.20"`, `"^2.0"` など、省略時は全バージョン適合）。
- `optional`: `true` の場合、ライブラリ未導入時も警告のみが表示されプラグインは実行可能です。`false`（必須依存）の場合は実行前にセットアップ警告モーダルが提示されます。

### 2) 推奨設計パターン：1層ラップ（Backend Adapter パターン）

外部依存ライブラリ（NumPy 等）をオプショナルとして扱う際、**ビジネスロジックの各所で `try...import` や `if has_numpy:` 分岐を散乱させることは重大なアンチパターン**です。

#### ❌ アンチパターン：ビジネスロジック全体への条件分岐散乱
```python
# 悪い例: アルゴリズム各所にライブラリ有無の分岐が散らばる
def compute_cost(grid):
    try:
        import numpy as np
        arr = np.array(grid)
        # NumPy による計算
        ...
    except ImportError:
        # Pure Python による計算（二重保守、境界処理の不整合バグの温床）
        ...

def filter_noise(grid):
    if has_numpy:
        ...
    else:
        ...
```
- **問題点**:
  1. 同じアルゴリズムを NumPy 版と Pure Python 版で 2 箇所に書くことになり、保守コストが 2 倍になる。
  2. 境界値（丸め誤差、インデックス外参照、境界モード）の僅かな差異によって環境依存の挙動差・再現不能バグが生じる。
  3. テストマトリクスが複雑化し、エッジケースの検証が極めて困難になる。

####  推奨パターン：公式リファレンス実装 `wpt_plugin.array`
公式 SDK の `wpt_plugin.array` では、この問題を解決する **Backend Adapter パターン（1層ラップ）** を提供しています。

```
                    [ ユーザーのプラグイン ロジック ]
                                   │
                                   ▼
                [ 抽象インターフェース (GridArrayBackend) ]
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [ 高速バックエンド (NumpyGridBackend) ]     [ 純粋フォールバック (PurePythonGridBackend) ]
   (NumPy / SciPy C 拡張による超高速処理)      (標準ライブラリのみ、外部依存ゼロ)
```

1. **抽象インターフェース (`GridArrayBackend`)**:
   - `erode(grid, radius)`: 円形構造要素による収縮
   - `dilate(grid, radius)`: 円形構造要素による膨張
   - `distance_transform(grid)`: 高速ユークリッド距離変換 (EDT)
   - `gaussian_blur(grid, sigma)`: 分離可能 2D ガウシアン平滑化フィルタ
2. **単一の境界プローブ (`get_grid_backend()`)**:
   - モジュールロード時・初回呼び出し時に 1 度だけ環境を検出し、最適なバックエンドを透過的に選定。
3. **ビジネスロジックの単純化**:
   - プラグイン作者は外部ライブラリの有無を一切気にせず、トップレベル関数（またはアダプタ経由）を呼び出すだけで安全かつ最大効率の処理が行われます：

```python
from wpt_plugin import PluginGenerator, PluginResult
from wpt_plugin.array import erode, dilate, distance_transform, gaussian_blur

class RobustFilterPlugin(PluginGenerator):
    def generate(self, context):
        grid = self.get_occupancy_grid(context)
        # NumPy があれば C 拡張で一瞬で完了、無ければ純粋 Python ループで自動実行
        # どちらの環境でも得られる結果（セル値）は数学的に完全に一致します
        eroded_grid = erode(grid.to_list(), radius=2)
        dist_map = distance_transform(eroded_grid)
        smoothed = gaussian_blur(dist_map, sigma=1.5)
        ...
```

---

## 10. パイプラインプラグイン (Pipeline Plugins: `type: "pipeline"`)

複数の単機能プラグイン（ノイズ除去レイヤー生成 ➔ 走行可能領域解析 ➔ 走査経路生成 等）を宣言的に結合し、1 クリックで一連のワークフローを実行するプラグインです。

### 1) パイプラインの定義 (`manifest.json`)
パイプラインプラグインには Python 実行ファイル（`main.py`）は不要です。`manifest.json` の `pipeline.steps` 配列に実行順序とデータ配管（バインディング）を記述します。

```json
{
  "name": "Noise Filtered Sweep Pipeline",
  "version": "1.0.0",
  "type": "pipeline",
  "description": "ノイズ除去マスクを生成した後に、指定領域の走査カバレッジ経路を生成します。",
  "pipeline": {
    "steps": [
      {
        "step_id": "filter_step",
        "plugin_id": "noise_filter_layer_generator",
        "name": "Noise Filter Preprocessing",
        "bindings": {
          "roi_region": "sweep_rect"
        },
        "property_overrides": {
          "mode": "remove_obstacles",
          "noise_size": 0.15
        },
        "exports": {
          "custom_layers": false,
          "waypoints": false,
          "annotations": false
        }
      },
      {
        "step_id": "sweep_step",
        "plugin_id": "rect_search_generator",
        "name": "Generate Sweep Route",
        "bindings": {
          "sweep_rect": "sweep_rect"
        },
        "property_overrides": {
          "num_lines": 6,
          "sweep_direction": "Horizontal"
        },
        "exports": {
          "custom_layers": false,
          "waypoints": true,
          "annotations": false
        }
      }
    ]
  }
}
```

### 2) レシピフィールド仕様
- `step_id`: パイプライン内で一意のステップ識別子。
- `plugin_id`: 呼び出すプラグインのフォルダ ID または識別名。
- `bindings`:
  - 前段ステップの出力を参照: `"$steps.<step_id>.custom_layers[0]"` や `"$steps.<step_id>.waypoints"`
  - 共通手動入力の共有: 複数ステップで同じ入力（例: `"sweep_rect"`）をバインドすることで、ユーザーはキャンバス上で 1 回矩形を描画するだけで全ステップにその座標が共有されます。
- `property_overrides`: そのステップ実行時のみ適用したい固定プロパティ値の上書き。
- `exports`: 出力ルーティング制御（不要な中間データの破棄）。
  - `custom_layers`: `false` にすると、そのステップで生成されたレイヤー画像はプロジェクトのレイヤー一覧に保存されず、後続ステップへの内部受け渡しのみに利用されます。
  - `waypoints`: `true` にすると、最終的なウェイポイントとしてプロジェクトツリーに追加されます。

### 3) 実行ライフサイクルと同期再生成 (`generatorStash`)
1. **事前パラメータ集約 (`extractPipelineParameters`)**:
   - パイプライン実行前に、バインディングやオーバーライドで解決されていない「未束縛の入力・プロパティ」のみが抽出され、UI にすっきりと集約表示されます。
2. **アトミックトランザクション実行**:
   - パイプライン全体の実行は 1 つのアトミックな履歴トランザクション（`beginHistoryTransaction`）内で完了します。途中でエラーが発生した場合は自動的に全ステップが元の状態にロールバックされ、Undo/Redo も 1 アクションで綺麗に元に戻せます。
3. **同期再生成 (`generatorStash`)**:
   - 生成された各オブジェクトには `pipeline_metadata`（`pipeline_id`, `pipeline_execution_id`, `step_id`）が付与されます。パイプラインパラメータを変更して再生成した際、同一パイプライン実行に属する関連オブジェクト群が一括して整合性を保ちながら置き換えられます。

---

## 11. ツール支援による仮想環境・依存関係の分離管理 (`.venv` & `pythonOverridePath`)

ROS Waypoint Tool は、OS 全体の Python 環境（システム Python）を汚染することなく、プラグインごとの独立した仮想環境実行を公式にサポートしています。

### 1) 仮想環境の優先解決順序
プラグイン実行時、Tauri バックエンドは以下の優先度で Python 実行ファイルを特定します：

1. **プラグイン個別設定 (`pythonOverridePath`)**:
   - Settings > Plugins または UI から個別に指定された Python インタプリタの絶対パス。
2. **プラグインローカル仮想環境 (`<plugin_dir>/.venv`)**:
   - 各プラグインフォルダ直下の `.venv/bin/python`（Windows では `.venv\Scripts\python.exe`）。
3. **アプリ共通仮想環境 (`<app_data_dir>/plugins/.venv`)**:
   - プラグイン共通環境が存在する場合に自動利用。
4. **システム Python (`python3` または `python`)**:
   - システム PATH から検出されたグローバル Python。

### 2) UI からの 1 クリック仮想環境セットアップ (VenvSetupModal)
`manifest.json` の `python_dependencies` に記載された外部ライブラリが現在の Python 環境に不足している場合、Settings > Plugins タブ上で警告バッジ（⚠️ Missing Dependencies）が表示され、「Setup Environment」ボタンが有効化されます。

モーダルを開いて「Create .venv & Install」をクリックすると、ツールがバックグラウンドで以下を安全に実行します：
1. `python3 -m venv <plugin_dir>/.venv` による独立した仮想環境の初期化
2. `.venv/bin/pip install` によるマニフェスト記載ライブラリの自動インストール
3. インストール完了後、自動的にそのプラグインの実行パスが `.venv` 内の Python に切り替わります。

これにより、ユーザーにターミナル操作を強いることなく、NumPy や SciPy を用いた高度な Python プラグインをワンストップで稼働させることができます。


