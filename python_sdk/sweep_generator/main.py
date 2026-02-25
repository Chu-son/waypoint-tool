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
# SDK (wpt_plugin.py) は python_sdk/ ディレクトリのルートに配置されています。
# 各プラグインは python_sdk/<plugin_name>/ 内に存在するため、
# 親ディレクトリを sys.path に追加して SDK をインポートします。
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator


class SweepPathGenerator(WaypointGenerator):
    """平行走査線（スイープパス）を生成するジェネレータープラグイン。

    始点の位置・ヨー角に基づき、指定された pitch（間隔）で複数の平行線を生成します。
    各線は始点と終点の 2 つの Waypoint で構成されます。

    Manifest で宣言する入力:
        - start_point (type: point): 始点の位置・方向をユーザーがクリックで指定

    Manifest で宣言するプロパティ:
        - pitch_x (float): 走査線の長さ（前進方向の距離, m）
        - pitch_y (float): 走査線間の間隔（横方向の距離, m）
        - num_lines (int): 走査線の本数
        - snake_pattern (bool): True の場合、偶数番目の線は逆方向
        - flip_endpoint_yaw (bool): [Normal] 線の終端でヨー角を 180° 反転
        - endpoint_faces_next (bool): [Snake] 線の終端を次の線の始点へ向ける
    """

    def generate(self, context):
        """Waypoint を生成するメインロジック。

        Args:
            context: Waypoint Tool から渡されるコンテキスト辞書

        Returns:
            Waypoint 辞書のリスト（transform 形式）
        """

        # ──────────────────────────────────────────────────────────────
        # Step 2: インタラクション入力の取得
        # ──────────────────────────────────────────────────────────────
        # manifest.json の `inputs` で宣言した ID ("start_point") をキーに、
        # ユーザーが MapCanvas 上でクリックした点データを取得します。
        # get_interaction_data() は SDK のヘルパーメソッドで、
        # 入力が未定義の場合は None を返します。
        start_point = self.get_interaction_data(context, "start_point")
        if not start_point:
            self.log("No start_point defined — returning empty list.")
            return []

        # 始点座標の取得
        base_x = float(start_point.get("x", 0.0))
        base_y = float(start_point.get("y", 0.0))

        # クォータニオン → ヨー角変換（SDK ユーティリティ使用）
        # ユーザーがクリック後にドラッグして設定した方向を取得します。
        base_yaw = self.quaternion_to_yaw(start_point)

        # ──────────────────────────────────────────────────────────────
        # Step 3: プロパティ（パラメータ）の取得
        # ──────────────────────────────────────────────────────────────
        # manifest.json の `properties` で宣言した各パラメータを取得します。
        # get_property() は SDK のヘルパーメソッドで、デフォルト値も指定できます。
        pitch_x = float(self.get_property(context, "pitch_x", default=10.0))
        pitch_y = float(self.get_property(context, "pitch_y", default=1.0))
        num_lines = int(self.get_property(context, "num_lines", default=5))
        snake_pattern = bool(self.get_property(context, "snake_pattern", default=False))
        flip_endpoint_yaw = bool(self.get_property(context, "flip_endpoint_yaw", default=False))
        endpoint_faces_next = bool(self.get_property(context, "endpoint_faces_next", default=False))

        # ──────────────────────────────────────────────────────────────
        # Step 4: Waypoint 座標の計算
        # ──────────────────────────────────────────────────────────────
        # ローカル座標系（始点基準、base_yaw 方向が +X）で各点を計算し、
        # ワールド座標系に回転・平行移動して変換します。
        waypoints = []

        cos_y = math.cos(base_yaw)
        sin_y = math.sin(base_yaw)

        for i in range(num_lines):
            # ローカル Y 方向のオフセット（走査線間の間隔）
            local_y = i * pitch_y

            # 蛇行パターン: 奇数番目の線は逆方向に走査
            is_reverse_pass = snake_pattern and (i % 2 == 1)

            # 走査線の始点・終点のローカル X 座標
            # Normal:  [0, y] → [pitch_x, y]
            # Snake:   偶数: [0, y] → [pitch_x, y]  /  奇数: [pitch_x, y] → [0, y]
            p1_local_x = pitch_x if is_reverse_pass else 0.0
            p2_local_x = 0.0 if is_reverse_pass else pitch_x

            # ローカル座標 → ワールド座標への変換
            def to_world(lx, ly):
                wx = base_x + (lx * cos_y - ly * sin_y)
                wy = base_y + (lx * sin_y + ly * cos_y)
                return wx, wy

            w1_x, w1_y = to_world(p1_local_x, local_y)
            w2_x, w2_y = to_world(p2_local_x, local_y)

            # ── ヨー角の算出 ──
            if snake_pattern:
                forward_yaw = base_yaw
                reverse_yaw = base_yaw + math.pi

                if not is_reverse_pass:
                    w1_yaw = forward_yaw
                    w2_yaw = (base_yaw + math.pi / 2.0) if endpoint_faces_next else forward_yaw
                else:
                    w1_yaw = reverse_yaw
                    w2_yaw = (base_yaw + math.pi / 2.0) if endpoint_faces_next else reverse_yaw
            else:
                w1_yaw = base_yaw
                w2_yaw = (base_yaw + math.pi) if flip_endpoint_yaw else base_yaw

            # ヨー角を [-π, π] に正規化
            w1_yaw = math.atan2(math.sin(w1_yaw), math.cos(w1_yaw))
            w2_yaw = math.atan2(math.sin(w2_yaw), math.cos(w2_yaw))

            # ──────────────────────────────────────────────────────────
            # Step 5: 標準フォーマットで出力を構築
            # ──────────────────────────────────────────────────────────
            # SDK の make_waypoint() ヘルパーを使うことで、
            # 統一された transform フォーマットの Waypoint を安全に構築できます。
            # x, y, yaw を渡すだけでクォータニオン変換も自動で行われます。

            waypoints.append(self.make_waypoint(
                w1_x, w1_y, w1_yaw,
                options={"generated_by": "SweepGenerator", "sweep_line_id": i},
                precision=3,
            ))
            waypoints.append(self.make_waypoint(
                w2_x, w2_y, w2_yaw,
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
