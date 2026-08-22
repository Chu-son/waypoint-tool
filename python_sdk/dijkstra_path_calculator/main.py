"""
Dijkstra Obstacle Avoidance Path Calculator
=============================================
ウェイポイント間を障害物（OccupancyGrid）およびロボットの安全マージンを考慮して
ダイクストラ / A* アルゴリズムで探索し、詳細な経路ポリライン点列を出力するプラグイン。
"""

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import PathCalculator


class DijkstraPathCalculator(PathCalculator):
    # PathCalculator 基底クラスの calculate_path / find_segment_path / run_from_stdin を継承
    pass


if __name__ == "__main__":
    DijkstraPathCalculator().run_from_stdin()
