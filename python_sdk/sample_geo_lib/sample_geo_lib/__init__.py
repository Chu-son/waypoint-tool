"""
Sample Shared Geometry Library (sample_geo_lib)
================================================
共有ライブラリプラグイン（type: "python_library"）の公式サンプル実装。
多角形面積の算出、パスの平滑化、経路長計算などの共通関数を提供します。
"""

import math
from typing import List, Tuple, Union


def polygon_area(points: List[Union[Tuple[float, float], List[float]]]) -> float:
    """Shoelace formula（靴紐の公式）を用いて多角形の符号なし面積を算出します。

    Args:
        points: (x, y) 座標のリスト。頂点は時計回りまたは反時計回りに整列されている必要があります。

    Returns:
        多角形の面積（非負の浮動小数点数）
    """
    n = len(points)
    if n < 3:
        return 0.0

    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        xi, yi = points[i][0], points[i][1]
        xj, yj = points[j][0], points[j][1]
        area += xi * yj - xj * yi

    return abs(area) / 2.0


def smooth_trajectory(
    points: List[Union[Tuple[float, float], List[float]]],
    alpha: float = 0.5,
    iterations: int = 2,
) -> List[Tuple[float, float]]:
    """Chaikin のアルゴリズムを用いて点列（軌道）の角を丸め、滑らかな曲線を生成します。

    Args:
        points: (x, y) 座標のリスト
        alpha: 分割比率（0.0 < alpha < 0.5、デフォルト 0.25 〜 0.5 付近）
        iterations: 平滑化の反復回数（1 以上の整数）

    Returns:
        平滑化された (x, y) 座標のリスト。始点と終点は保持されます。
    """
    if len(points) <= 2 or iterations <= 0:
        return [(float(p[0]), float(p[1])) for p in points]

    curr = [(float(p[0]), float(p[1])) for p in points]
    clamped_alpha = max(0.05, min(0.45, alpha))

    for _ in range(iterations):
        smoothed = [curr[0]]
        for i in range(len(curr) - 1):
            p0 = curr[i]
            p1 = curr[i + 1]

            q = (
                (1.0 - clamped_alpha) * p0[0] + clamped_alpha * p1[0],
                (1.0 - clamped_alpha) * p0[1] + clamped_alpha * p1[1],
            )
            r = (
                clamped_alpha * p0[0] + (1.0 - clamped_alpha) * p1[0],
                clamped_alpha * p0[1] + (1.0 - clamped_alpha) * p1[1],
            )
            smoothed.append(q)
            smoothed.append(r)
        smoothed.append(curr[-1])
        curr = smoothed

    return curr


def path_length(points: List[Union[Tuple[float, float], List[float]]]) -> float:
    """連続する点間のユークリッド距離の合計（累積経路長）を算出します。

    Args:
        points: (x, y) 座標のリスト

    Returns:
        合計距離（メートル）
    """
    if len(points) < 2:
        return 0.0

    total = 0.0
    for i in range(len(points) - 1):
        dx = points[i + 1][0] - points[i][0]
        dy = points[i + 1][1] - points[i][1]
        total += math.hypot(dx, dy)

    return total


__all__ = ["polygon_area", "smooth_trajectory", "path_length"]
