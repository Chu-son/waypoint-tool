"""
Sweep Path Generator — リファレンス実装サンプル
================================================

このプラグインは、Waypoint Tool の Python プラグイン開発における
**リファレンス実装（お手本）** です。新しいプラグインを作成する際は、
このファイルの構造に倣ってください。

機能概要:
    ユーザーが MapCanvas 上でクリックした始点（start_point）から、
    指定された方向・間隔で平行な走査線（スイープパス）を生成します。
    蛇行パターン（snake pattern）のオン/オフも可能です。

プラグインの基本構造 (5 ステップ):
    Step 1. SDK インポートと WaypointGenerator 継承
    Step 2. インタラクション入力の取得
    Step 3. プロパティ（パラメータ）の取得
    Step 4. Waypoint 座標の計算
    Step 5. 標準フォーマットで出力を構築
"""

import sys
import os
import math

# ──────────────────────────────────────────────────────────────────────────
# Step 1: SDK のインポートと WaypointGenerator クラスの継承
# ──────────────────────────────────────────────────────────────────────────
# SDK (wpt_plugin) は python_sdk/ ディレクトリのルートに配置されています。
# 親ディレクトリを sys.path に追加して SDK をインポートします。
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin.core import WaypointGenerator
from wpt_plugin.geometry import Point
from wpt_plugin.utils import normalize_yaw


class SweepPathGenerator(WaypointGenerator):
    """平行走査線（スイープパス）を生成するジェネレータープラグイン。
    """

    def generate(self, context):
        """Waypoint を生成するメインロジック。
        """

        # ──────────────────────────────────────────────────────────────
        # Step 2: インタラクション入力の取得
        # ──────────────────────────────────────────────────────────────
        # get_interaction_point() を使用して、始点を Point オブジェクトとして取得します。
        start = self.get_interaction_point(context, "start_point")
        if not start:
            self.log("No start_point defined — returning empty list.")
            return []

        # ──────────────────────────────────────────────────────────────
        # Step 3: プロパティ（パラメータ）の取得
        # ──────────────────────────────────────────────────────────────
        pitch_x = float(self.get_property(context, "pitch_x", default=10.0))
        pitch_y = float(self.get_property(context, "pitch_y", default=1.0))
        num_lines = int(self.get_property(context, "num_lines", default=5))
        snake_pattern = bool(self.get_property(context, "snake_pattern", default=False))
        flip_endpoint_yaw = bool(self.get_property(context, "flip_endpoint_yaw", default=False))
        endpoint_faces_next = bool(self.get_property(context, "endpoint_faces_next", default=False))

        # ──────────────────────────────────────────────────────────────
        # Step 4: Waypoint 座標の計算
        # ──────────────────────────────────────────────────────────────
        # ローカル座標系で各点を計算し、Point.to_world() でワールド座標に変換します。
        waypoints = []

        for i in range(num_lines):
            # ローカル Y 方向のオフセット（走査線間の間隔）
            local_y = i * pitch_y

            # 蛇行パターン: 奇数番目の線は逆方向に走査
            is_reverse_pass = snake_pattern and (i % 2 == 1)

            # 走査線の始点・終点のローカル X 座標
            p1_local_x = pitch_x if is_reverse_pass else 0.0
            p2_local_x = 0.0 if is_reverse_pass else pitch_x

            w1_pt = Point(p1_local_x, local_y).to_world(start.x, start.y, start.yaw)
            w2_pt = Point(p2_local_x, local_y).to_world(start.x, start.y, start.yaw)

            # ── ヨー角の算出 ──
            if snake_pattern:
                forward_yaw = start.yaw
                reverse_yaw = start.yaw + math.pi

                if not is_reverse_pass:
                    w1_yaw = forward_yaw
                    w2_yaw = (start.yaw + math.pi / 2.0) if endpoint_faces_next else forward_yaw
                else:
                    w1_yaw = reverse_yaw
                    w2_yaw = (start.yaw + math.pi / 2.0) if endpoint_faces_next else reverse_yaw
            else:
                w1_yaw = start.yaw
                w2_yaw = (start.yaw + math.pi) if flip_endpoint_yaw else start.yaw

            # ヨー角の正規化
            w1_yaw = normalize_yaw(w1_yaw)
            w2_yaw = normalize_yaw(w2_yaw)

            # ──────────────────────────────────────────────────────────
            # Step 5: 標準フォーマットで出力を構築
            # ──────────────────────────────────────────────────────────
            waypoints.append(self.make_waypoint(
                w1_pt.x, w1_pt.y, w1_pt.yaw if w1_pt.yaw is not None else w1_yaw,
                options={"generated_by": "SweepGenerator", "sweep_line_id": i},
                precision=3,
            ))
            waypoints.append(self.make_waypoint(
                w2_pt.x, w2_pt.y, w2_pt.yaw if w2_pt.yaw is not None else w2_yaw,
                options={"generated_by": "SweepGenerator", "sweep_line_id": i},
                precision=3,
            ))

        self.log(f"Generated {len(waypoints)} waypoints across {num_lines} lines.")
        return waypoints


# ──────────────────────────────────────────────────────────────────────────
# エントリーポイント
# ──────────────────────────────────────────────────────────────────────────
# Waypoint Tool は `python main.py` としてこのスクリプトを起動し、
# stdin に JSON コンテキストを流し込みます。
# run_from_stdin() が stdin 読み取り → generate() 呼び出し → stdout 出力を処理します。
if __name__ == "__main__":
    SweepPathGenerator().run_from_stdin()
