"""
Interpolation Generator
========================

既存の Waypoint の間をピッチ指定で補完するプラグイン。
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator, Point


class InterpolationGenerator(WaypointGenerator):
    """2点（またはそれ以上の範囲）の間を等間隔で補完するジェネレーター。
    """

    def generate(self, context):
        # waypoint_range はフロントエンドから渡される WaypointNode のリスト
        # 各ノードは 'transform' プロパティを持つ
        nodes = context.get("waypoint_range", [])
        if len(nodes) < 2:
            self.log("Insufficient waypoints in range (need at least 2).")
            return []

        pitch = float(self.get_property(context, "pitch", default=1.0))
        if pitch <= 0.01:
            pitch = 0.01

        # 座標リストの作成
        path_points = []
        for node in nodes:
            t = node.get("transform")
            if t:
                path_points.append(Point(t["x"], t["y"], yaw=self._get_yaw_from_transform(t)))

        if len(path_points) < 2:
            return []

        generated_waypoints = []
        
        # 各セグメントごとに補完
        for i in range(len(path_points) - 1):
            p1 = path_points[i]
            p2 = path_points[i+1]
            
            dist = p1.distance_to(p2)
            num_segments = math.ceil(dist / pitch)
            if num_segments < 1:
                num_segments = 1
                
            actual_pitch = dist / num_segments
            
            # セグメントの開始点（最初のセグメントのみ追加、以降は前のセグメントの終点と重なるため）
            if i == 0:
                generated_waypoints.append(self.make_waypoint(
                    p1.x, p1.y, p1.yaw,
                    options={"generated_by": "InterpolationGenerator", "original": True}
                ))

            # 中間点の生成
            for j in range(1, num_segments):
                ratio = j / num_segments
                interp_x = p1.x + (p2.x - p1.x) * ratio
                interp_y = p1.y + (p2.y - p1.y) * ratio
                
                # Yaw は単純な線形補完（または p1 の yaw を維持）
                # ここでは進行方向に向ける
                seg_yaw = math.atan2(p2.y - p1.y, p2.x - p1.x)
                
                generated_waypoints.append(self.make_waypoint(
                    interp_x, interp_y, seg_yaw,
                    options={"generated_by": "InterpolationGenerator", "interp": True}
                ))
            
            # セグメントの終点
            generated_waypoints.append(self.make_waypoint(
                p2.x, p2.y, p2.yaw,
                options={"generated_by": "InterpolationGenerator", "original": True}
            ))

        self.log(f"Interpolated {len(generated_waypoints)} waypoints over {len(path_points)-1} segments.")
        return generated_waypoints

    def _get_yaw_from_transform(self, t):
        qx = t.get("qx", 0)
        qy = t.get("qy", 0)
        qz = t.get("qz", 0)
        qw = t.get("qw", 1)
        return math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz))


if __name__ == "__main__":
    InterpolationGenerator().run_from_stdin()
