"""
Line Generator プラグイン
=========================

始点の位置・方向に沿って、等間隔に Waypoint を直線配置するプラグイン。
最もシンプルな構造のプラグインであり、SDK の基本的な使い方を示します。
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator


class LineGenerator(WaypointGenerator):
    """始点から直線方向に等間隔の Waypoint を生成するプラグイン。

    ユーザーが MapCanvas 上でクリックした始点の位置とヨー角を基準に、
    その方向へ num_points 個の Waypoint を spacing 間隔で配置します。
    """

    def generate(self, context):
        # インタラクション入力: 始点の取得
        start_point = self.get_interaction_data(context, "start_point")
        if not start_point:
            return []

        base_x = float(start_point.get("x", 0.0))
        base_y = float(start_point.get("y", 0.0))
        yaw = self.quaternion_to_yaw(start_point)

        # プロパティの取得
        num_points = max(1, int(self.get_property(context, "num_points", default=5)))
        spacing = float(self.get_property(context, "spacing", default=1.0))
        if spacing <= 0.01:
            spacing = 0.01

        cos_y = math.cos(yaw)
        sin_y = math.sin(yaw)

        # Waypoint の生成（transform 形式）
        waypoints = []
        for i in range(num_points):
            distance = i * spacing
            wx = base_x + distance * cos_y
            wy = base_y + distance * sin_y

            waypoints.append(self.make_waypoint(
                wx, wy, yaw,
                options={"generated_by": "LineGenerator", "line_index": i},
            ))

        self.log(f"Generated {len(waypoints)} waypoints along line.")
        return waypoints


if __name__ == "__main__":
    LineGenerator().run_from_stdin()
