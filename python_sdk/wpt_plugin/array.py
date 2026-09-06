"""
Grid Array Processing Module (1-Layer Wrap / Backend Adapter Pattern)
=====================================================================
2D 格子配列（占有格子マップ、マスク画像など）に対する画像処理・モルフォロジー演算・
距離変換・平滑化処理を抽象化する公式リファレンス実装。

NumPy / SciPy がインストールされている環境では高速な C 実装（Scipy/Numpy）を使用し、
標準ライブラリのみの環境では純粋 Python ループ実装へ自動フォールバックします。
ビジネスロジック側でライブラリの有無による条件分岐を散乱させず、本モジュール経由で
透過的に同一の演算結果を得ることができます。
"""

from abc import ABC, abstractmethod
import math
from typing import List, Optional, Tuple


class GridArrayBackend(ABC):
    """2D 格子配列処理バックエンドの抽象インターフェース。"""

    @abstractmethod
    def erode(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        """障害物・前景（非ゼロ領域）に対する収縮（Erosion）演算。

        Args:
            grid: 2次元整数配列（0: 背景/自由空間, 1以上: 前景/障害物）
            radius: 円形構造要素の半径（セル単位、0 以下の場合は入力の二値化コピー）
            border_value: 境界外セルの仮想値（デフォルト 0: 境界外は背景）

        Returns:
            収縮後の 2次元整数配列（0 または 1）
        """
        pass

    @abstractmethod
    def dilate(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        """障害物・前景（非ゼロ領域）に対する膨張（Dilation）演算。

        Args:
            grid: 2次元整数配列（0: 背景/自由空間, 1以上: 前景/障害物）
            radius: 円形構造要素の半径（セル単位、0 以下の場合は入力の二値化コピー）
            border_value: 境界外セルの仮想値（デフォルト 0: 境界外は背景）

        Returns:
            膨張後の 2次元整数配列（0 または 1）
        """
        pass

    @abstractmethod
    def distance_transform(self, grid: List[List[int]]) -> List[List[float]]:
        """非ゼロセルから最も近いゼロセル（背景）へのユークリッド距離変換（EDT）。

        Args:
            grid: 2次元整数配列（0: 背景、非ゼロ: 前景）

        Returns:
            各セルから最近傍背景セルへのユークリッド距離（float）の 2次元配列。
            ゼロセル自身の距離は 0.0。背景が存在しない全前景セルの場合は float('inf')。
        """
        pass

    @abstractmethod
    def gaussian_blur(self, grid: List[List[float]], sigma: float, mode: str = "reflect") -> List[List[float]]:
        """2次元ガウシアン平滑化フィルタ。

        Args:
            grid: 2次元浮動小数点配列
            sigma: ガウス関数の標準偏差（0 以下の場合は入力のコピー）
            mode: 境界拡張モード ('reflect' または 'nearest')

        Returns:
            平滑化後の 2次元浮動小数点配列
        """
        pass


def _build_disk_kernel_offsets(radius: int) -> List[Tuple[int, int]]:
    """円形構造要素の相対オフセットリストを生成。"""
    offsets = []
    r_sq = radius * radius
    for dr in range(-radius, radius + 1):
        for dc in range(-radius, radius + 1):
            if dr * dr + dc * dc <= r_sq:
                offsets.append((dr, dc))
    return offsets


def _edt_1d_parabolic(f: List[float], n: int) -> List[float]:
    """Felzenszwalb-Huttenlocher アルゴリズムによる 1次元二乗ユークリッド距離変換 (O(N))。"""
    inf = float("inf")
    first_finite = -1
    for i in range(n):
        if f[i] < inf:
            first_finite = i
            break
    if first_finite == -1:
        return [inf] * n

    d = [inf] * n
    v = [0] * n
    z = [0.0] * (n + 1)
    k = 0
    v[0] = first_finite
    z[0] = -inf
    z[1] = inf

    for q in range(first_finite + 1, n):
        if f[q] >= inf:
            continue
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2.0 * (q - v[k]))
        while s <= z[k]:
            k -= 1
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2.0 * (q - v[k]))
        k += 1
        v[k] = q
        z[k] = s
        z[k + 1] = inf

    k = 0
    for q in range(n):
        while z[k + 1] < q:
            k += 1
        dx = q - v[k]
        d[q] = dx * dx + f[v[k]]
    return d


def _reflect_index(idx: int, length: int) -> int:
    """SciPy reflect (d c b a | a b c d | d c b a) 互換の境界インデックス計算。"""
    if length <= 1:
        return 0
    while idx < 0 or idx >= length:
        if idx < 0:
            idx = -idx - 1
        elif idx >= length:
            idx = 2 * length - 1 - idx
    return idx


def _nearest_index(idx: int, length: int) -> int:
    """Nearest (edge clamping) 互換の境界インデックス計算。"""
    if idx < 0:
        return 0
    if idx >= length:
        return length - 1
    return idx


class PurePythonGridBackend(GridArrayBackend):
    """標準ライブラリのみで実装された純粋 Python バックエンド。"""

    def erode(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        if not grid or not grid[0]:
            return []
        height = len(grid)
        width = len(grid[0])
        if radius <= 0:
            return [[1 if val != 0 else 0 for val in row] for row in grid]

        kernel_offsets = _build_disk_kernel_offsets(radius)
        dst = [[0 for _ in range(width)] for _ in range(height)]

        for r in range(height):
            row = grid[r]
            for c in range(width):
                if row[c] == 0:
                    continue
                # 前景セルの場合、カーネル内の全近傍が非ゼロであるか判定
                keep = True
                for dr, dc in kernel_offsets:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < height and 0 <= nc < width:
                        val = grid[nr][nc]
                    else:
                        val = border_value
                    if val == 0:
                        keep = False
                        break
                if keep:
                    dst[r][c] = 1

        return dst

    def dilate(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        if not grid or not grid[0]:
            return []
        height = len(grid)
        width = len(grid[0])
        if radius <= 0:
            return [[1 if val != 0 else 0 for val in row] for row in grid]

        kernel_offsets = _build_disk_kernel_offsets(radius)
        dst = [[0 for _ in range(width)] for _ in range(height)]

        for r in range(height):
            row = grid[r]
            for c in range(width):
                if row[c] != 0:
                    dst[r][c] = 1
                    continue
                # 背景セルの場合、カーネル内に 1 つでも非ゼロ近傍が存在するか判定
                expand = False
                for dr, dc in kernel_offsets:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < height and 0 <= nc < width:
                        val = grid[nr][nc]
                    else:
                        val = border_value
                    if val != 0:
                        expand = True
                        break
                if expand:
                    dst[r][c] = 1

        return dst

    def distance_transform(self, grid: List[List[int]]) -> List[List[float]]:
        if not grid or not grid[0]:
            return []
        height = len(grid)
        width = len(grid[0])

        inf = float("inf")
        has_zero = any(grid[r][c] == 0 for r in range(height) for c in range(width))
        if not has_zero:
            return [[inf for _ in range(width)] for _ in range(height)]

        # 初期値: 0 は 0.0、非ゼロは inf
        f = [[0.0 if grid[r][c] == 0 else inf for c in range(width)] for r in range(height)]

        # パス 1: 列ごとの 1D 変換
        for c in range(width):
            col = [f[r][c] for r in range(height)]
            d_col = _edt_1d_parabolic(col, height)
            for r in range(height):
                f[r][c] = d_col[r]

        # パス 2: 行ごとの 1D 変換および平方根
        result = [[0.0 for _ in range(width)] for _ in range(height)]
        for r in range(height):
            d_row = _edt_1d_parabolic(f[r], width)
            for c in range(width):
                result[r][c] = math.sqrt(d_row[c]) if d_row[c] < inf else inf

        return result

    def gaussian_blur(self, grid: List[List[float]], sigma: float, mode: str = "reflect") -> List[List[float]]:
        if not grid or not grid[0]:
            return []
        height = len(grid)
        width = len(grid[0])
        if sigma <= 0.0:
            return [[float(val) for val in row] for row in grid]

        truncate = 4.0
        radius = int(truncate * float(sigma) + 0.5)
        if radius == 0:
            return [[float(val) for val in row] for row in grid]

        # 1D ガウスカーネルの計算
        two_sigma_sq = 2.0 * sigma * sigma
        weights = [math.exp(-(k * k) / two_sigma_sq) for k in range(-radius, radius + 1)]
        sum_weights = sum(weights)
        weights = [w / sum_weights for w in weights]
        k_len = len(weights)

        idx_fn = _nearest_index if mode == "nearest" else _reflect_index

        # 水平パス (行方向の畳み込み)
        temp = [[0.0 for _ in range(width)] for _ in range(height)]
        for r in range(height):
            row = grid[r]
            for c in range(width):
                acc = 0.0
                for ki in range(k_len):
                    k = ki - radius
                    sc = idx_fn(c + k, width)
                    acc += row[sc] * weights[ki]
                temp[r][c] = acc

        # 垂直パス (列方向の畳み込み)
        result = [[0.0 for _ in range(width)] for _ in range(height)]
        for c in range(width):
            for r in range(height):
                acc = 0.0
                for ki in range(k_len):
                    k = ki - radius
                    sr = idx_fn(r + k, height)
                    acc += temp[sr][c] * weights[ki]
                result[r][c] = acc

        return result


class NumpyGridBackend(GridArrayBackend):
    """NumPy および SciPy を活用した高速バックエンド。"""

    def __init__(self):
        try:
            import numpy as np

            self._np = np
        except ImportError as e:
            raise RuntimeError("NumPy is not installed") from e

        try:
            import scipy.ndimage as ndi

            self._ndi = ndi
        except ImportError:
            self._ndi = None

        self._fallback = PurePythonGridBackend()

    def _get_disk_struct(self, radius: int):
        np = self._np
        y, x = np.ogrid[-radius : radius + 1, -radius : radius + 1]
        return x * x + y * y <= radius * radius

    def erode(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        if not grid or not grid[0]:
            return []
        if radius <= 0:
            return [[1 if val != 0 else 0 for val in row] for row in grid]

        if self._ndi is not None:
            np = self._np
            arr = np.array(grid, dtype=bool)
            struct = self._get_disk_struct(radius)
            eroded = self._ndi.binary_erosion(arr, structure=struct, border_value=border_value)
            return eroded.astype(int).tolist()
        else:
            return self._fallback.erode(grid, radius, border_value=border_value)

    def dilate(self, grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
        if not grid or not grid[0]:
            return []
        if radius <= 0:
            return [[1 if val != 0 else 0 for val in row] for row in grid]

        if self._ndi is not None:
            np = self._np
            arr = np.array(grid, dtype=bool)
            struct = self._get_disk_struct(radius)
            dilated = self._ndi.binary_dilation(arr, structure=struct, border_value=border_value)
            return dilated.astype(int).tolist()
        else:
            return self._fallback.dilate(grid, radius, border_value=border_value)

    def distance_transform(self, grid: List[List[int]]) -> List[List[float]]:
        if not grid or not grid[0]:
            return []

        np = self._np
        arr = np.array(grid)
        if not np.any(arr == 0):
            h, w = arr.shape
            return [[float("inf") for _ in range(w)] for _ in range(h)]

        if self._ndi is not None:
            dt = self._ndi.distance_transform_edt(arr != 0)
            return dt.astype(float).tolist()
        else:
            return self._fallback.distance_transform(grid)

    def gaussian_blur(self, grid: List[List[float]], sigma: float, mode: str = "reflect") -> List[List[float]]:
        if not grid or not grid[0]:
            return []
        if sigma <= 0.0:
            return [[float(val) for val in row] for row in grid]

        if self._ndi is not None:
            np = self._np
            arr = np.array(grid, dtype=float)
            scipy_mode = "nearest" if mode == "nearest" else "reflect"
            blurred = self._ndi.gaussian_filter(arr, sigma=sigma, mode=scipy_mode, truncate=4.0)
            return blurred.astype(float).tolist()
        else:
            return self._fallback.gaussian_blur(grid, sigma, mode=mode)


_active_backend: Optional[GridArrayBackend] = None


def get_grid_backend() -> GridArrayBackend:
    """利用可能な最適なグリッド処理バックエンド（NumPy / PurePython）を取得。"""
    global _active_backend
    if _active_backend is None:
        try:
            import numpy  # noqa: F401

            _active_backend = NumpyGridBackend()
        except Exception:
            _active_backend = PurePythonGridBackend()
    return _active_backend


def set_grid_backend(backend: Optional[GridArrayBackend]) -> None:
    """アクティブなバックエンドを明示的に切り替え（テスト・ベンチマーク用）。"""
    global _active_backend
    _active_backend = backend


# --- トップレベル便利関数 ---


def erode(grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
    """アクティブなバックエンドを使用して収縮演算を実行。"""
    return get_grid_backend().erode(grid, radius, border_value=border_value)


def dilate(grid: List[List[int]], radius: int, border_value: int = 0) -> List[List[int]]:
    """アクティブなバックエンドを使用して膨張演算を実行。"""
    return get_grid_backend().dilate(grid, radius, border_value=border_value)


def distance_transform(grid: List[List[int]]) -> List[List[float]]:
    """アクティブなバックエンドを使用してユークリッド距離変換を実行。"""
    return get_grid_backend().distance_transform(grid)


def gaussian_blur(grid: List[List[float]], sigma: float, mode: str = "reflect") -> List[List[float]]:
    """アクティブなバックエンドを使用してガウシアン平滑化を実行。"""
    return get_grid_backend().gaussian_blur(grid, sigma, mode=mode)
