"""
Line Path Generator
====================

始点の位置・方向に沿って、等間隔に Waypoint を直線配置するプラグイン。
"""

import sys
import os

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator, Point


class LinePathGenerator(WaypointGenerator):
    """始点から直線方向に等間隔の Waypoint を生成するプラグイン。
    """

    def generate(self, context):
        start = self.get_interaction_point(context, "start_point")
        if not start:
            return []

        # プロパティの取得
        num_points = max(1, int(self.get_property(context, "num_points", default=5)))
        spacing = float(self.get_property(context, "spacing", default=1.0))
        if spacing <= 0.01:
            spacing = 0.01

        # Waypoint の生成
        waypoints = []
        for i in range(num_points):
            distance = i * spacing
            local_pt = Point(distance, 0)
            world_pt = local_pt.to_world(start.x, start.y, start.yaw)

            waypoints.append(self.make_waypoint(
                world_pt.x, world_pt.y, start.yaw,
                options={"generated_by": "LinePathGenerator", "line_index": i},
            ))

        self.log(f"Generated {len(waypoints)} waypoints along line.")
        return waypoints


if __name__ == "__main__":
    LinePathGenerator().run_from_stdin()
