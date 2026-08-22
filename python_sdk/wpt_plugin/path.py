"""
PathCalculator - パス計算・障害物回避ルータープラグイン向け基底クラスおよび探索ユーティリティ
"""

import sys
import json
import math
import heapq
import traceback
from typing import Dict, Any, List, Optional, Tuple

from .core import PluginBase
from .geometry import Point
from .occupancy_grid import OccupancyGrid
from .footprint import RobotFootprint


def is_line_clear(
    p_a: Point,
    p_b: Point,
    is_blocked_fn,
    occupancy_grid: OccupancyGrid,
) -> bool:
    """始点・終点間の線分上にブロックされたセルが存在しないかレイキャスト判定。"""
    dist = math.hypot(p_b.x - p_a.x, p_b.y - p_a.y)
    num_samples = max(2, int(math.ceil(dist / (occupancy_grid.resolution * 0.5))))
    for i in range(num_samples + 1):
        t = i / float(num_samples)
        x = p_a.x + t * (p_b.x - p_a.x)
        y = p_a.y + t * (p_b.y - p_a.y)
        c, r = occupancy_grid.world_to_grid(x, y)
        if is_blocked_fn(r, c):
            return False
    return True


def shortcut_smooth_path(
    points: List[Point],
    is_blocked_fn,
    occupancy_grid: OccupancyGrid,
) -> List[Point]:
    """A* 格子点列に対し、視線（Line-of-Sight）が通る区間を直線ショートカットして平滑化。"""
    if len(points) <= 2:
        return points

    smoothed = [points[0]]
    curr_idx = 0
    n = len(points)

    while curr_idx < n - 1:
        next_idx = n - 1
        while next_idx > curr_idx + 1:
            if is_line_clear(points[curr_idx], points[next_idx], is_blocked_fn, occupancy_grid):
                break
            next_idx -= 1
        smoothed.append(points[next_idx])
        curr_idx = next_idx

    return smoothed


def interpolate_path(points: List[Point], step_size: float = 0.05) -> List[Point]:
    """平滑化後の折れ線点列を指定 step_size 間隔で密に補間。"""
    if len(points) <= 1 or step_size <= 0:
        return points

    interpolated: List[Point] = [points[0]]
    for i in range(len(points) - 1):
        p_a, p_b = points[i], points[i + 1]
        dist = math.hypot(p_b.x - p_a.x, p_b.y - p_a.y)
        if dist <= step_size:
            interpolated.append(p_b)
            continue

        num_steps = int(dist / step_size)
        for s in range(1, num_steps + 1):
            t = (s * step_size) / dist
            if t < 1.0:
                interpolated.append(Point(p_a.x + t * (p_b.x - p_a.x), p_a.y + t * (p_b.y - p_a.y)))
        interpolated.append(p_b)

    return interpolated


def find_dijkstra_path(
    occupancy_grid: OccupancyGrid,
    start: Point,
    goal: Point,
    footprint: Optional[RobotFootprint] = None,
    padding: float = 0.0,
    step_size: float = 0.05,
    max_search_nodes: int = 500000,
) -> Optional[List[Point]]:
    """OccupancyGrid 上で A* / ダイクストラ法を用いて障害物を回避する経路を探索する。

    Args:
        occupancy_grid: 占有格子マップ
        start: 始点（ワールド座標）
        goal: 終点（ワールド座標）
        footprint: ロボットフットプリント（任意）
        padding: 安全マージン（メートル）
        step_size: 経路補間ステップ（メートル）
        max_search_nodes: 最大展開ノード数（長距離探索対応: デフォルト 500,000）

    Returns:
        始点から終点までの Point リスト。到達不能な場合は None。
    """
    res = occupancy_grid.resolution
    ox, oy = occupancy_grid.origin[0], occupancy_grid.origin[1]
    width, height = occupancy_grid.width, occupancy_grid.height

    start_c, start_r = occupancy_grid.world_to_grid(start.x, start.y)
    goal_c, goal_r = occupancy_grid.world_to_grid(goal.x, goal.y)

    # 範囲外チェック
    if not (0 <= start_c < width and 0 <= start_r < height):
        print(f"[PLUGIN] Start point ({start.x:.2f}, {start.y:.2f}) is outside map bounds.", file=sys.stderr)
        return None
    if not (0 <= goal_c < width and 0 <= goal_r < height):
        print(f"[PLUGIN] Goal point ({goal.x:.2f}, {goal.y:.2f}) is outside map bounds.", file=sys.stderr)
        return None

    # 障害物膨張セル半径の計算
    inflation_cells = max(0, int(math.ceil(padding / res))) if padding > 0 else 0
    inflation_cells_sq = inflation_cells * inflation_cells

    # キャッシュ用辞書（O(1) ルックアップ）
    blocked_cache: Dict[Tuple[int, int], bool] = {}

    def is_cell_blocked(r: int, c: int) -> bool:
        if r < 0 or r >= height or c < 0 or c >= width:
            return True
        key = (r, c)
        if key in blocked_cache:
            return blocked_cache[key]

        if occupancy_grid.is_obstacle_cell(r, c):
            blocked_cache[key] = True
            return True

        if inflation_cells == 0:
            blocked_cache[key] = False
            return False

        # 膨張チェック
        for dr in range(-inflation_cells, inflation_cells + 1):
            for dc in range(-inflation_cells, inflation_cells + 1):
                if dr * dr + dc * dc <= inflation_cells_sq:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < height and 0 <= nc < width:
                        if occupancy_grid.is_obstacle_cell(nr, nc):
                            blocked_cache[key] = True
                            return True
        blocked_cache[key] = False
        return False

    def find_nearest_unblocked_cell(r: int, c: int, max_radius: int = 15) -> Optional[Tuple[int, int]]:
        if not is_cell_blocked(r, c):
            return (r, c)
        for rad in range(1, max_radius + 1):
            for dr in range(-rad, rad + 1):
                for dc in range(-rad, rad + 1):
                    if max(abs(dr), abs(dc)) == rad:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < height and 0 <= nc < width and not is_cell_blocked(nr, nc):
                            return (nr, nc)
        return None

    # 始点・終点がインフレーション壁際にある場合の自動スナップ（リカバリー）
    search_start_r, search_start_c = start_r, start_c
    if is_cell_blocked(start_r, start_c):
        cand = find_nearest_unblocked_cell(start_r, start_c, max_radius=max(inflation_cells + 8, 15))
        if cand:
            search_start_r, search_start_c = cand
        else:
            print(f"[PLUGIN] Start point ({start.x:.2f}, {start.y:.2f}) is trapped inside obstacles.", file=sys.stderr)
            return None

    search_goal_r, search_goal_c = goal_r, goal_c
    if is_cell_blocked(goal_r, goal_c):
        cand = find_nearest_unblocked_cell(goal_r, goal_c, max_radius=max(inflation_cells + 8, 15))
        if cand:
            search_goal_r, search_goal_c = cand
        else:
            print(f"[PLUGIN] Goal point ({goal.x:.2f}, {goal.y:.2f}) is trapped inside obstacles.", file=sys.stderr)
            return None

    # A* 探索
    # priority queue: (f_score, g_score, (r, c))
    h_start = math.hypot(search_goal_r - search_start_r, search_goal_c - search_start_c)
    open_set = [(h_start, 0.0, (search_start_r, search_start_c))]
    came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
    g_score: Dict[Tuple[int, int], float] = {(search_start_r, search_start_c): 0.0}
    closed_set = set()

    # 8近傍移動: (dr, dc, cost)
    SQRT2 = math.sqrt(2)
    neighbors = [
        (0, 1, 1.0), (0, -1, 1.0), (1, 0, 1.0), (-1, 0, 1.0),
        (1, 1, SQRT2), (1, -1, SQRT2), (-1, 1, SQRT2), (-1, -1, SQRT2),
    ]

    nodes_expanded = 0
    reached = False

    while open_set and nodes_expanded < max_search_nodes:
        _, current_g, current = heapq.heappop(open_set)
        if current in closed_set:
            continue
        closed_set.add(current)
        nodes_expanded += 1

        curr_r, curr_c = current
        if curr_r == search_goal_r and curr_c == search_goal_c:
            reached = True
            break

        for dr, dc, cost in neighbors:
            nr, nc = curr_r + dr, curr_c + dc
            neighbor = (nr, nc)
            if neighbor in closed_set or is_cell_blocked(nr, nc):
                continue

            tentative_g = current_g + cost
            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h = math.hypot(search_goal_r - nr, search_goal_c - nc)
                heapq.heappush(open_set, (tentative_g + h, tentative_g, neighbor))

    if not reached:
        dist_m = math.hypot(goal.x - start.x, goal.y - start.y)
        print(f"[PLUGIN] A* could not reach goal ({goal.x:.2f}, {goal.y:.2f}) from start ({start.x:.2f}, {start.y:.2f}) [dist={dist_m:.1f}m, expanded={nodes_expanded} nodes].", file=sys.stderr)
        return None

    # 経路復元
    curr = (search_goal_r, search_goal_c)
    grid_path = [curr]
    while curr in came_from:
        curr = came_from[curr]
        grid_path.append(curr)
    grid_path.reverse()

    # グリッド座標からワールド座標点列への変換
    raw_points: List[Point] = [Point(start.x, start.y)]
    for r, c in grid_path:
        wx, wy = occupancy_grid.grid_to_world(r, c)
        raw_points.append(Point(wx, wy))
    raw_points.append(Point(goal.x, goal.y))

    # 経路平滑化（Raycast ショートカット）
    smoothed_points = shortcut_smooth_path(raw_points, is_cell_blocked, occupancy_grid)

    # ステップサイズで密に補間
    final_points = interpolate_path(smoothed_points, step_size=step_size)

    dist_m = math.hypot(goal.x - start.x, goal.y - start.y)
    print(f"[PLUGIN] Found path: {len(final_points)} points across {dist_m:.2f}m (expanded {nodes_expanded} nodes, smoothed to {len(smoothed_points)} vertices).", file=sys.stderr)

    return final_points


class PathCalculator(PluginBase):
    """パス計算・経路ルータープラグインの基底クラス。"""

    def calculate_path(self, context: Dict[str, Any]) -> List[List[Point]]:
        """全区間のパスセグメントリストを生成して返す。
        
        デフォルト実装では、context['waypoints'] の各連続2点間を
        self.find_segment_path で順次計算します。
        """
        waypoints_data = context.get("waypoints", [])
        if not waypoints_data or len(waypoints_data) < 2:
            return []

        avoid_obstacles = bool(self.get_property(context, "avoid_obstacles", True))
        use_robot_footprint = bool(self.get_property(context, "use_robot_footprint", True))
        safety_margin = float(self.get_property(context, "safety_margin", 0.15))
        step_size = float(self.get_property(context, "step_size", 0.05))

        grid = self.get_occupancy_grid(context) if avoid_obstacles else None
        footprint = self.get_robot_footprint(context) if use_robot_footprint else None

        # Effective clearance (padding) includes robot footprint radius when available
        effective_padding = safety_margin
        if footprint is not None:
            effective_padding += footprint.get_bounding_radius()

        waypoints: List[Point] = []
        for wp in waypoints_data:
            if isinstance(wp, dict):
                t = wp.get("transform", wp)
                waypoints.append(Point(t.get("x", 0.0), t.get("y", 0.0)))

        segments: List[List[Point]] = []
        for i in range(len(waypoints) - 1):
            p1 = waypoints[i]
            p2 = waypoints[i + 1]
            if not avoid_obstacles or grid is None:
                segments.append([p1, p2])
            else:
                seg = self.find_segment_path(grid, p1, p2, footprint, effective_padding, step_size)
                if seg:
                    segments.append(seg)
                else:
                    # フォールバック（直線2点）
                    segments.append([p1, p2])

        return segments

    def find_segment_path(
        self,
        grid: Optional[OccupancyGrid],
        start: Point,
        goal: Point,
        footprint: Optional[RobotFootprint] = None,
        safety_margin: float = 0.1,
        step_size: float = 0.05,
    ) -> Optional[List[Point]]:
        """単一区間（start -> goal）の経路を探索する。"""
        if grid is None:
            return [start, goal]
        
        return find_dijkstra_path(
            occupancy_grid=grid,
            start=start,
            goal=goal,
            footprint=footprint,
            padding=safety_margin,
            step_size=step_size,
        )

    def run_from_stdin(self):
        """標準入出力 (stdin / stdout) 通信ループ。"""
        try:
            input_data = sys.stdin.read()
            if not input_data.strip():
                print(json.dumps({"segments": []}))
                return

            context = json.loads(input_data)
            segments = self.calculate_path(context)

            # JSON シリアライズ: segments: [ [ { x, y }, ... ], ... ]
            serialized_segments = []
            for seg in segments:
                seg_pts = []
                for pt in seg:
                    seg_pts.append({
                        "x": round(pt.x, 6),
                        "y": round(pt.y, 6),
                    })
                serialized_segments.append(seg_pts)

            output = {
                "segments": serialized_segments
            }
            print(json.dumps(output))

        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
            sys.exit(1)
