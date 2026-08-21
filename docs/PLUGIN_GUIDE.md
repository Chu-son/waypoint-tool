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
- `inputs`: キャンバス上での操作入力を定義。
  - `type: "point"`: 座標と向きをクリックで指定。
  - `type: "rectangle"`: 範囲をドラッグで指定。
- `properties`: UI に表示されるパラメータ（数値、文字列、真偽値等）。
  - `interaction_hints`: キャンバス上にプレビュー図形を描画するためのヒント情報。
- `needs`: アプリ本体から追加情報（マップや選択中のポイントなど）を要求する場合に指定。現在サポートされている値は以下の通りです：
  - `"selected_points"`: ユーザーが選択している Waypoint のインデックスリスト (`context["selected_points"]`) を注入します。
  - `"occupancy_grid"`: 現在表示されているマップ画像から占有格子データを生成し (`context["occupancy_grid"]`) 注入します。
  - `"occupancy_grid_in_region"`: `inputs` で指定した `rectangle` の範囲内のみの占有格子データを生成し注入します（全体を生成するより高速です）。
  - `"robot_footprint"`: プロジェクト設定で定義されたロボットの形状・寸法データ (`context["robot_footprint"]`) を注入します。

## 4. インタラクションヒント (Interaction Hints)

プラグイン側からキャンバス上の描画を制御するための仕組みです。プロパティにヒントを紐付けることで、コアコードの修正なしに視認性の高い UI を実現できます。

例: 走査の開始コーナーを指定するドロップダウンに対し、キャンバス上に「ここから開始します」という矢印を表示する。

## 5. Python SDK の利用

組み込みの `wpt_plugin` パッケージを利用することを推奨します。SDK には、座標計算を容易にする幾何学クラスが含まれています。

### 基本的な構造
```python
from wpt_plugin import WaypointGenerator, Point, RobotFootprint

class MyGenerator(WaypointGenerator):
    def generate(self, context):
        # 1. 入力データの取得 (オブジェクトとして取得可能)
        start = self.get_interaction_point(context, "start_point")
        if not start:
            return []

        # ロボットフットプリントの取得 (needs: ["robot_footprint"] 指定時)
        footprint = self.get_robot_footprint(context)

        # 2. パラメータの取得
        count = self.get_property(context, "count", 5)
        spacing = self.get_property(context, "spacing", 1.0)

        # 3. 幾何計算 (Point, Line, Rectangle, Ray, RobotFootprint クラスが利用可能)
        points = []
        for i in range(count):
            # ローカル座標で点を定義し、ワールド座標へ変換
            p = Point(i * spacing, 0).to_world(start.x, start.y, start.yaw)
            points.append(self.make_waypoint(p.x, p.y, p.yaw))
            
        return points

if __name__ == "__main__":
    MyGenerator().run_from_stdin()
```

### 利用可能な幾何学クラス
- `Point(x, y, yaw)`: 座標と向き。`to_world()` メソッドで変換可能。
- `Line(p1, p2)`: 線分。長さの取得や交点判定が可能。
- `Rectangle(center, width, height, yaw)`: 矩形。頂点の取得や点の内包判定が可能。
- `Ray(origin, yaw, bidirectional)`: 仮想無限線。線分や矩形との交点取得に便利。
- `RobotFootprint(type, radius, length, width, offset_x, offset_y, points)`: ロボットの形状・寸法。
  - `self.get_robot_footprint(context)` で取得可能（`needs` で要求した場合）。
  - `to_polygon(num_circle_segments)`: ロボットローカル座標系の頂点リスト `List[Point]` を返す。
  - `to_world(x, y, yaw)`: 指定位置・姿勢におけるワールド座標系の頂点リスト `List[Point]` を返す。
  - `is_point_inside(px, py, robot_x, robot_y, robot_yaw)`: 点の内包判定。
- `OccupancyGrid(data)`: 占有格子マップクラス（ROS Nav2互換）。
  - `self.get_occupancy_grid(context)` で取得可能（`needs` で要求した場合）。
  - `is_obstacle(x, y)`: ワールド座標が障害物かどうかを判定。
  - `is_footprint_colliding(footprint, x, y, yaw, padding)`: 指定姿勢でのロボットフットプリントと障害物の衝突を判定。
  - `find_first_obstacle_on_segment(p1, p2, inflation_radius)`: 線分上で最初に出現する障害物座標を返す（回避計算に有用）。

詳細は `wpt_plugin` ディレクトリ内のソースコードおよび既存のプラグイン実装（`rect_search_generator` や `zigzag_path_generator` 等）を参照してください。

## 6. プラグインの登録
1. アプリの Settings > Plugins タブを開きます。
2. 「Add Custom Plugin」をクリックし、プラグインディレクトリを選択します。
3. 自動的にリストに追加され、ジェネレーターとして利用可能になります。
   - ※ SDK のバージョンが古い場合は「Update SDK」ボタンが表示されます。
