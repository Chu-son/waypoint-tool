"""
MapLayerGenerator - マップレイヤー生成プラグイン向け基底クラスおよび画像生成ヘルパー
"""

import sys
import json
import zlib
import struct
import base64
import traceback
from typing import Dict, Any, List, Optional, Tuple, Sequence

from .core import PluginBase
from .occupancy_grid import OccupancyGrid


def _make_png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """PNG チャンク（4B 長さ + 4B タイプ + データ + 4B CRC32）を生成する。"""
    length = struct.pack(">I", len(data))
    crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    return length + chunk_type + data + crc


def encode_rgba_to_png_bytes(rgba_data: bytes, width: int, height: int) -> bytes:
    """RGBA バイト列（width * height * 4）を PNG バイナリへエンコードする（外部依存なし）。"""
    if len(rgba_data) != width * height * 4:
        raise ValueError(f"Data length {len(rgba_data)} does not match {width}x{height}x4")

    # PNG ヘッダ
    header = b"\x89PNG\r\n\x1a\n"

    # IHDR: width(4), height(4), bit_depth=8(1), color_type=6(RGBA)(1), comp=0(1), filter=0(1), interlace=0(1)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr = _make_png_chunk(b"IHDR", ihdr_data)

    # IDAT: 各行の先頭に filter_byte (0 = None) を付与して圧縮
    raw_scanlines = bytearray()
    row_stride = width * 4
    for y in range(height):
        raw_scanlines.append(0)  # Filter byte None
        start = y * row_stride
        raw_scanlines.extend(rgba_data[start:start + row_stride])

    compressed = zlib.compress(bytes(raw_scanlines), level=6)
    idat = _make_png_chunk(b"IDAT", compressed)

    # IEND
    iend = _make_png_chunk(b"IEND", b"")

    return header + ihdr + idat + iend


def encode_rgba_to_png_base64(rgba_data: bytes, width: int, height: int) -> str:
    """RGBA バイト列を Base64 PNG Data URL 文字列へ変換する。"""
    png_bytes = encode_rgba_to_png_bytes(rgba_data, width, height)
    b64_str = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def _parse_color_rgba(color_input: Any, default_alpha: int = 180) -> Tuple[int, int, int, int]:
    """Parse color input (tuple/list or '#RRGGBB' / '#RRGGBBAA' hex string) into RGBA tuple (0~255)."""
    if isinstance(color_input, str):
        hex_str = color_input.strip().lstrip("#")
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            return (r, g, b, default_alpha)
        elif len(hex_str) == 8:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            a = int(hex_str[6:8], 16)
            return (r, g, b, a)
        elif len(hex_str) == 3:
            r = int(hex_str[0] * 2, 16)
            g = int(hex_str[1] * 2, 16)
            b = int(hex_str[2] * 2, 16)
            return (r, g, b, default_alpha)
    if isinstance(color_input, (tuple, list)):
        if len(color_input) >= 4:
            return (int(color_input[0]), int(color_input[1]), int(color_input[2]), int(color_input[3]))
        elif len(color_input) == 3:
            return (int(color_input[0]), int(color_input[1]), int(color_input[2]), default_alpha)
    return (34, 197, 94, default_alpha)


class MapLayerGenerator(PluginBase):
    """マップレイヤーを生成するプラグインの基底クラス。"""

    def generate_layer(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """マップレイヤーの辞書を生成して返す。サブクラスで必ずオーバーライドしてください。"""
        raise NotImplementedError("Plugins must implement the 'generate_layer' method.")

    def run_from_stdin(self):
        """標準入出力 (stdin / stdout) 通信ループ。"""
        try:
            input_data = sys.stdin.read()
            if not input_data.strip():
                print("{}")
                return

            context = json.loads(input_data)
            result = self.generate_layer(context)

            if not isinstance(result, dict):
                raise ValueError(f"Expected dict from generate_layer, got {type(result)}")

            print(json.dumps(result))

        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
            sys.exit(1)

    @staticmethod
    def create_layer_from_mask(
        mask_2d: Sequence[Sequence[Any]],
        origin: Sequence[float],
        resolution: float,
        name: str = "Generated Layer",
        blend_mode: str = "overwrite",
        color_rgba: Any = (34, 197, 94, 180),
        bg_rgba: Any = (0, 0, 0, 0),
    ) -> Dict[str, Any]:
        """2次元配列マスク（行×列、True/1 で着色）からレイヤー辞書を作成する。
        
        Args:
            mask_2d: 2次元シーケンス (height x width)。0/False 以外のセルに color_rgba を適用。
            origin: [x, y, yaw]
            resolution: メートル/ピクセル
            name: レイヤー名
            blend_mode: 'overwrite' | 'merge_obstacles' | 'merge_free'
            color_rgba: 有効セルの RGBA (0~255) または '#RRGGBB' hex 文字列
            bg_rgba: 背景セルの RGBA (0~255) または '#RRGGBB' hex 文字列
        """
        height = len(mask_2d)
        if height == 0:
            raise ValueError("mask_2d is empty")
        width = len(mask_2d[0])

        rgba_bytes = bytearray(width * height * 4)
        c_r, c_g, c_b, c_a = _parse_color_rgba(color_rgba, default_alpha=180)
        b_r, b_g, b_b, b_a = _parse_color_rgba(bg_rgba, default_alpha=0)

        idx = 0
        for r in range(height):
            row = mask_2d[r]
            for c in range(width):
                if row[c]:
                    rgba_bytes[idx] = c_r
                    rgba_bytes[idx + 1] = c_g
                    rgba_bytes[idx + 2] = c_b
                    rgba_bytes[idx + 3] = c_a
                else:
                    rgba_bytes[idx] = b_r
                    rgba_bytes[idx + 1] = b_g
                    rgba_bytes[idx + 2] = b_b
                    rgba_bytes[idx + 3] = b_a
                idx += 4

        image_base64 = encode_rgba_to_png_base64(bytes(rgba_bytes), width, height)

        return {
            "name": name,
            "image_base64": image_base64,
            "info": {
                "resolution": float(resolution),
                "origin": [float(origin[0]), float(origin[1]), float(origin[2]) if len(origin) > 2 else 0.0],
                "width": int(width),
                "height": int(height),
            },
            "blend_mode": blend_mode,
        }

    @staticmethod
    def create_layer_from_grid(
        occupancy_grid: OccupancyGrid,
        name: str = "Grid Layer",
        blend_mode: str = "overwrite",
        obstacle_rgba: Tuple[int, int, int, int] = (0, 0, 0, 255),
        free_rgba: Tuple[int, int, int, int] = (255, 255, 255, 255),
        unknown_rgba: Tuple[int, int, int, int] = (128, 128, 128, 0),
    ) -> Dict[str, Any]:
        """OccupancyGrid インスタンスから直接レイヤー辞書を作成する。"""
        width = occupancy_grid.width
        height = occupancy_grid.height
        rgba_bytes = bytearray(width * height * 4)

        idx = 0
        for r in range(height):
            for c in range(width):
                cell = occupancy_grid.get_cell(r, c)
                if cell == OccupancyGrid.OBSTACLE:
                    rgba_bytes[idx:idx + 4] = bytes(obstacle_rgba)
                elif cell == OccupancyGrid.FREE:
                    rgba_bytes[idx:idx + 4] = bytes(free_rgba)
                else:
                    rgba_bytes[idx:idx + 4] = bytes(unknown_rgba)
                idx += 4

        image_base64 = encode_rgba_to_png_base64(bytes(rgba_bytes), width, height)

        return {
            "name": name,
            "image_base64": image_base64,
            "info": {
                "resolution": float(occupancy_grid.resolution),
                "origin": [float(occupancy_grid.origin[0]), float(occupancy_grid.origin[1]), float(occupancy_grid.origin[2]) if len(occupancy_grid.origin) > 2 else 0.0],
                "width": int(width),
                "height": int(height),
            },
            "blend_mode": blend_mode,
        }
