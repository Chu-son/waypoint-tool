"""
Zigzag Path Generator
======================

機能概要:
    ユーザーが MapCanvas 上でクリックした始点（start_point）から、
    指定された方向・間隔で平行な走査線を生成します。
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin.core import WaypointGenerator
from wpt_plugin.geometry import Point
from wpt_plugin.utils import normalize_yaw


class ZigzagPathGenerator(WaypointGenerator):
    """平行走査線を生成するジェネレータープラグイン。
    """

    def generate(self, context):
        """Waypoint を生成するメインロジック。
        """

        # Step 2: インタラクション入力の取得
        start = self.get_interaction_point(context, "start_point")
        if not start:
            self.log("No start_point defined — returning empty list.")
            return []

        # Step 3: プロパティ（パラメータ）の取得
        pitch_x = float(self.get_property(context, "pitch_x", default=10.0))
        pitch_y = float(self.get_property(context, "pitch_y", default=1.0))
        num_lines = int(self.get_property(context, "num_lines", default=5))
        flip_endpoint_yaw = bool(self.get_property(context, "flip_endpoint_yaw", default=False))

        # Step 4: Waypoint 座標の計算
        waypoints = []

        for i in range(num_lines):
            # ローカル Y 方向のオフセット
            local_y = i * pitch_y

            # 常に同一方向に走査（Zigzag）
            p1_local_x = 0.0
            p2_local_x = pitch_x

            w1_pt = Point(p1_local_x, local_y).to_world(start.x, start.y, start.yaw)
            w2_pt = Point(p2_local_x, local_y).to_world(start.x, start.y, start.yaw)

            # ── ヨー角の算出 ──
            w1_yaw = start.yaw
            w2_yaw = (start.yaw + math.pi) if flip_endpoint_yaw else start.yaw

            # ヨー角の正規化
            w1_yaw = normalize_yaw(w1_yaw)
            w2_yaw = normalize_yaw(w2_yaw)

            # Step 5: 標準フォーマットで出力を構築
            waypoints.append(self.make_waypoint(
                w1_pt.x, w1_pt.y, w1_pt.yaw if w1_pt.yaw is not None else w1_yaw,
                options={"generated_by": "ZigzagPathGenerator", "line_id": i},
                precision=3,
            ))
            waypoints.append(self.make_waypoint(
                w2_pt.x, w2_pt.y, w2_pt.yaw if w2_pt.yaw is not None else w2_yaw,
                options={"generated_by": "ZigzagPathGenerator", "line_id": i},
                precision=3,
            ))

        self.log(f"Generated {len(waypoints)} waypoints across {num_lines} lines.")
        return waypoints


if __name__ == "__main__":
    ZigzagPathGenerator().run_from_stdin()
