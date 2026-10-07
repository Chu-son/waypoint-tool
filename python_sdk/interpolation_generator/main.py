"""
Interpolation Generator
========================

指定した範囲のウェイポイントを、隣り合う点の間隔が最大間隔以下になるように細分化するプラグイン。

元の点は本体が初回実行時に ``context["waypoint_range"]`` として固定する。範囲にグループや入れ子の
ジェネレーターが含まれる場合は、その中の点も範囲の点として順に渡される（``group_path`` で所属が分かる）。
「グループ内も補間する」を外すと、同じグループの中の区間は分割しない。

階層ごと元の状態に戻すには、本体の「元に戻す」を使う。「細分化を有効にする」を外して再生成すると、
元の点だけが（フラットに）出力される。

出力する各点には ``stash_key`` を付ける。ピッチや有効/無効を切り替えて点数が変わっても、
生成物の中で手動編集した点を、再生成後の同じ点へ引き継げる。

- 元の点:  ``orig:{i}``（i は範囲内での番号。再生成しても変わらない）
- 補間点:  ``seg:{i}:{j}/{n}``（区間 i を n 分割したときの j 番目）
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import PluginGenerator, PluginResult

MIN_PITCH = 0.01


class InterpolationGenerator(PluginGenerator):
    """範囲内の隣り合うウェイポイントの間を等間隔に細分化するジェネレーター。"""

    def generate(self, context):
        originals = self.get_waypoint_range(context)
        if len(originals) < 2:
            self.log("Insufficient waypoints in range (need at least 2).")
            return PluginResult()

        enabled = bool(self.get_property(context, "enabled", default=True))
        # 旧バージョンの `pitch` も読む
        pitch = float(self.get_property(context, "max_pitch", default=self.get_property(context, "pitch", default=1.0)))
        pitch = max(pitch, MIN_PITCH)

        include_groups = bool(self.get_property(context, "include_groups", default=True))

        waypoints = []
        for i, original in enumerate(originals):
            previous = originals[i - 1] if i > 0 else None
            if previous is not None and enabled and (include_groups or not self._in_same_group(previous, original)):
                waypoints.extend(self._interpolate(previous, original, i - 1, pitch))
            waypoints.append(self._original_waypoint(original, i))

        res = PluginResult()
        res.add_waypoints(
            waypoints,
            plugin_data={
                "enabled": enabled,
                "max_pitch": pitch,
                "original_count": len(originals),
                "output_count": len(waypoints),
            },
        )
        self.log(f"{len(originals)} original waypoints -> {len(waypoints)} (enabled={enabled}, max_pitch={pitch}).")
        return res

    @staticmethod
    def _in_same_group(a, b):
        """範囲内で、同じ最上位のグループ（またはジェネレーター）の中にある2点か。

        group_path は範囲内での祖先コンテナの ID（外側が先頭）。範囲の直下の点は空。"""
        path_a, path_b = a.get("group_path") or [], b.get("group_path") or []
        return bool(path_a) and bool(path_b) and path_a[0] == path_b[0]

    @staticmethod
    def _original_waypoint(original, index):
        """元の点は姿勢（z・ロール・ピッチ含む）も名前も options もそのまま返し、Explode で元通りに戻せるようにする。"""
        wp = {
            "transform": dict(original["transform"]),
            "stash_key": f"orig:{index}",
        }
        if original.get("name") is not None:
            wp["name"] = original["name"]
        if original.get("options"):
            wp["options"] = dict(original["options"])
        return wp

    def _interpolate(self, start, end, segment_index, pitch):
        """start と end の間に入れる中間点を返す（両端は含まない）。"""
        a, b = start["transform"], end["transform"]
        ax, ay, az = a.get("x", 0.0), a.get("y", 0.0), a.get("z", 0.0)
        bx, by, bz = b.get("x", 0.0), b.get("y", 0.0), b.get("z", 0.0)

        dist = math.hypot(bx - ax, by - ay)
        # 浮動小数の誤差（1.1 / 0.1 = 11.000000000000002 など）で余分に1分割しないよう許容を持たせる
        count = math.ceil(dist / pitch - 1e-9)
        if count <= 1:
            return []

        yaw = math.atan2(by - ay, bx - ax)
        points = []
        for j in range(1, count):
            ratio = j / count
            wp = self.make_waypoint(
                ax + (bx - ax) * ratio,
                ay + (by - ay) * ratio,
                yaw,
                stash_key=f"seg:{segment_index}:{j}/{count}",
            )
            wp["transform"]["z"] = az + (bz - az) * ratio
            points.append(wp)
        return points


if __name__ == "__main__":
    InterpolationGenerator().run_from_stdin()
