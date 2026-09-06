"""Tests for MorphologicalNoiseFilterGenerator plugin."""
import sys
import os
import json
import io
import unittest
import zlib
import base64
import struct

import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)
from wpt_plugin import OccupancyGrid

_spec = importlib.util.spec_from_file_location('noise_filter_main', os.path.join(_parent, 'noise_filter_layer_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
MorphologicalNoiseFilterGenerator = _mod.MorphologicalNoiseFilterGenerator



def decode_png_base64_to_rgba(b64_str: str) -> tuple:
    """Helper to decode data:image/png;base64,... into (width, height, bytes)."""
    if b64_str.startswith("data:image/png;base64,"):
        b64_str = b64_str[len("data:image/png;base64,"):]
    png_bytes = base64.b64decode(b64_str)

    # Simple PNG parser to extract IDAT chunks
    pos = 8 # Skip PNG header
    width = 0
    height = 0
    idat_data = bytearray()

    while pos < len(png_bytes):
        length = struct.unpack(">I", png_bytes[pos:pos+4])[0]
        chunk_type = png_bytes[pos+4:pos+8]
        data = png_bytes[pos+8:pos+8+length]
        pos += 12 + length

        if chunk_type == b"IHDR":
            width, height = struct.unpack(">II", data[0:8])
        elif chunk_type == b"IDAT":
            idat_data.extend(data)

    decompressed = zlib.decompress(bytes(idat_data))
    row_stride = width * 4 + 1
    raw_rgba = bytearray(width * height * 4)

    for y in range(height):
        row_start = y * row_stride
        filter_byte = decompressed[row_start]
        # filter_byte is 0 (None)
        raw_rgba[y * width * 4:(y + 1) * width * 4] = decompressed[row_start + 1:row_start + row_stride]

    return width, height, bytes(raw_rgba)


class TestNoiseFilterPlugin(unittest.TestCase):
    def _create_mock_grid(self, width, height, resolution=0.05, origin=(0.0, 0.0, 0.0), default_val=0, custom_cells=None):
        cells = [default_val] * (width * height)
        if custom_cells:
            for r, c, val in custom_cells:
                if 0 <= r < height and 0 <= c < width:
                    cells[r * width + c] = val
        raw_bytes = struct.pack(f"{len(cells)}b", *cells)
        b64 = base64.b64encode(zlib.compress(raw_bytes)).decode('ascii')
        return {
            "width": width,
            "height": height,
            "resolution": resolution,
            "origin": list(origin),
            "data": b64
        }

    def _get_pixel_rgba(self, rgba_bytes: bytes, width: int, r: int, c: int) -> tuple:
        idx = (r * width + c) * 4
        return tuple(rgba_bytes[idx:idx + 4])

    def test_remove_isolated_obstacle_noise(self):
        """Opening should remove isolated obstacle point (1x1) in free space."""
        gen = MorphologicalNoiseFilterGenerator()
        # 10x10 free space with isolated obstacle at (5, 5)
        grid_data = self._create_mock_grid(
            10, 10, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=[(5, 5, OccupancyGrid.OBSTACLE)]
        )
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "mode": "remove_obstacles",
                "noise_size": 0.10, # radius = 1 cell
                "kernel_shape": "disk",
                "layer_name": "Noise Filter Layer"
            }
        }
        res = gen.generate_layer(context)
        self.assertEqual(res["name"], "Noise Filter Layer")
        self.assertEqual(res["blend_mode"], "overwrite")

        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])
        self.assertEqual((w, h), (10, 10))

        # (5, 5) should be modified to Free (white: 254, 254, 254, 255)
        self.assertEqual(self._get_pixel_rgba(rgba, w, 5, 5), (254, 254, 254, 255))
        # Other pixels should be completely transparent (0, 0, 0, 0)
        self.assertEqual(self._get_pixel_rgba(rgba, w, 0, 0), (0, 0, 0, 0))
        self.assertEqual(self._get_pixel_rgba(rgba, w, 5, 4), (0, 0, 0, 0))

    def test_preserve_large_obstacle(self):
        """Opening with square kernel should preserve large obstacles (e.g. 4x4 block)."""
        gen = MorphologicalNoiseFilterGenerator()
        # 10x10 with 4x4 obstacle block from (3,3) to (6,6)
        custom_cells = []
        for r in range(3, 7):
            for c in range(3, 7):
                custom_cells.append((r, c, OccupancyGrid.OBSTACLE))

        grid_data = self._create_mock_grid(
            10, 10, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=custom_cells
        )
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "mode": "remove_obstacles",
                "noise_size": 0.10, # radius = 1 cell
                "kernel_shape": "square"
            }
        }
        res = gen.generate_layer(context)
        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])

        # With square kernel, 4x4 block is perfectly preserved -> no pixels changed
        for r in range(h):
            for c in range(w):
                self.assertEqual(self._get_pixel_rgba(rgba, w, r, c), (0, 0, 0, 0))

        # With disk kernel, the central 2x2 of the 4x4 obstacle block is preserved
        context["properties"]["kernel_shape"] = "disk"
        res_disk = gen.generate_layer(context)
        _, _, rgba_disk = decode_png_base64_to_rgba(res_disk["image_base64"])
        # Inner 2x2 cells (4,4), (4,5), (5,4), (5,5) should not be modified
        for r in (4, 5):
            for c in (4, 5):
                self.assertEqual(self._get_pixel_rgba(rgba_disk, w, r, c), (0, 0, 0, 0))

    def test_both_modes(self):
        """'both' mode should perform Opening then Closing (remove noise and fill hole)."""
        gen = MorphologicalNoiseFilterGenerator()
        # 16x16 grid with isolated noise at (2, 2) in free area, and 1x1 hole at (8, 8) inside 9x9 obstacle block
        custom_cells = [(2, 2, OccupancyGrid.OBSTACLE)]
        for r in range(4, 13):
            for c in range(4, 13):
                custom_cells.append((r, c, OccupancyGrid.OBSTACLE))
        # Hole at (8, 8)
        custom_cells.append((8, 8, OccupancyGrid.FREE))

        grid_data = self._create_mock_grid(
            16, 16, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=custom_cells
        )
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "mode": "both",
                "noise_size": 0.10,
                "kernel_shape": "square"
            }
        }
        res = gen.generate_layer(context)
        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])

        # (2, 2) isolated obstacle was removed -> White
        self.assertEqual(self._get_pixel_rgba(rgba, w, 2, 2), (254, 254, 254, 255))
        # (8, 8) hole inside obstacle was filled -> Black
        self.assertEqual(self._get_pixel_rgba(rgba, w, 8, 8), (0, 0, 0, 255))


    def test_fill_holes(self):

        """Closing should fill small holes (1x1 free cell) inside obstacles."""
        gen = MorphologicalNoiseFilterGenerator()
        # 10x10 obstacle space with 1x1 hole at (5, 5)
        grid_data = self._create_mock_grid(
            10, 10, resolution=0.05,
            default_val=OccupancyGrid.OBSTACLE,
            custom_cells=[(5, 5, OccupancyGrid.FREE)]
        )
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "mode": "fill_holes",
                "noise_size": 0.10, # radius = 1 cell
                "kernel_shape": "disk"
            }
        }
        res = gen.generate_layer(context)
        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])

        # (5, 5) should be modified to Obstacle (black: 0, 0, 0, 255)
        self.assertEqual(self._get_pixel_rgba(rgba, w, 5, 5), (0, 0, 0, 255))
        # Other pixels should be transparent
        self.assertEqual(self._get_pixel_rgba(rgba, w, 0, 0), (0, 0, 0, 0))

    def test_unknown_space_protection(self):
        """Unknown space (-1) should remain untouched and not be altered."""
        gen = MorphologicalNoiseFilterGenerator()
        # Grid with unknown space and isolated obstacle in free area
        grid_data = self._create_mock_grid(
            10, 10, resolution=0.05,
            default_val=OccupancyGrid.UNKNOWN,
            custom_cells=[
                (2, 2, OccupancyGrid.FREE),
                (2, 3, OccupancyGrid.FREE),
                (2, 4, OccupancyGrid.FREE),
                (3, 2, OccupancyGrid.FREE),
                (3, 3, OccupancyGrid.OBSTACLE), # noise in free pocket
                (3, 4, OccupancyGrid.FREE),
                (4, 2, OccupancyGrid.FREE),
                (4, 3, OccupancyGrid.FREE),
                (4, 4, OccupancyGrid.FREE),
            ]
        )
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "mode": "remove_obstacles",
                "noise_size": 0.10,
                "kernel_shape": "disk"
            }
        }
        res = gen.generate_layer(context)
        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])

        # (3, 3) obstacle removed -> White (254, 254, 254, 255)
        self.assertEqual(self._get_pixel_rgba(rgba, w, 3, 3), (254, 254, 254, 255))
        # All unknown cells (like 0, 0) must remain transparent
        self.assertEqual(self._get_pixel_rgba(rgba, w, 0, 0), (0, 0, 0, 0))
        self.assertEqual(self._get_pixel_rgba(rgba, w, 1, 1), (0, 0, 0, 0))

    def test_roi_region_filtering(self):
        """Filter should only be applied within the specified ROI rectangle."""
        gen = MorphologicalNoiseFilterGenerator()
        # 10x10 free space with two noise points: (2, 2) inside ROI, (8, 8) outside ROI
        grid_data = self._create_mock_grid(
            10, 10, resolution=0.1, origin=(0.0, 0.0, 0.0),
            default_val=OccupancyGrid.FREE,
            custom_cells=[
                (2, 2, OccupancyGrid.OBSTACLE),
                (8, 8, OccupancyGrid.OBSTACLE),
            ]
        )
        grid_obj = OccupancyGrid(grid_data)
        roi_cx, roi_cy = grid_obj.grid_to_world(2, 2)

        # ROI covering (2, 2) area
        context = {
            "occupancy_grid": grid_data,
            "interaction_data": {
                "roi_region": {
                    "center": {"x": roi_cx, "y": roi_cy},
                    "width": 0.15,
                    "height": 0.15,
                    "yaw": 0.0
                }
            },
            "properties": {
                "mode": "remove_obstacles",
                "noise_size": 0.20,
                "kernel_shape": "disk"
            }
        }
        res = gen.generate_layer(context)
        w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])

        # (2, 2) inside ROI was removed -> White
        self.assertEqual(self._get_pixel_rgba(rgba, w, 2, 2), (254, 254, 254, 255))
        # (8, 8) outside ROI was NOT removed -> Transparent (0, 0, 0, 0)
        self.assertEqual(self._get_pixel_rgba(rgba, w, 8, 8), (0, 0, 0, 0))


    def test_kernel_shapes(self):
        """Test with different kernel shapes (cross, square, disk)."""
        gen = MorphologicalNoiseFilterGenerator()
        grid_data = self._create_mock_grid(
            10, 10, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=[(5, 5, OccupancyGrid.OBSTACLE)]
        )
        for shape in ["cross", "square", "disk"]:
            context = {
                "occupancy_grid": grid_data,
                "properties": {
                    "mode": "remove_obstacles",
                    "noise_size": 0.10,
                    "kernel_shape": shape
                }
            }
            res = gen.generate_layer(context)
            w, h, rgba = decode_png_base64_to_rgba(res["image_base64"])
            self.assertEqual(self._get_pixel_rgba(rgba, w, 5, 5), (254, 254, 254, 255))

    def test_run_from_stdin(self):
        """Test CLI stdin/stdout loop."""
        gen = MorphologicalNoiseFilterGenerator()
        grid_data = self._create_mock_grid(
            5, 5, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=[(2, 2, OccupancyGrid.OBSTACLE)]
        )
        payload = json.dumps({
            "occupancy_grid": grid_data,
            "properties": {"mode": "remove_obstacles", "noise_size": 0.10}
        })

        old_stdin = sys.stdin
        old_stdout = sys.stdout
        try:
            sys.stdin = io.StringIO(payload)
            sys.stdout = io.StringIO()
            gen.run_from_stdin()
            output_str = sys.stdout.getvalue()
            result = json.loads(output_str)
            self.assertIn("image_base64", result)
            self.assertEqual(result["blend_mode"], "overwrite")
        finally:
            sys.stdin = old_stdin
            sys.stdout = old_stdout

    def test_roi_region_string_or_invalid_fallback(self):
        """Verify that string or invalid roi_region in interaction_data does not crash."""
        gen = MorphologicalNoiseFilterGenerator()
        grid_data = self._create_mock_grid(
            5, 5, resolution=0.05,
            default_val=OccupancyGrid.FREE,
            custom_cells=[(2, 2, OccupancyGrid.OBSTACLE)]
        )
        for invalid_val in ["sweep_rect", "", "   ", 123, ["not", "a", "dict"]]:
            context = {
                "occupancy_grid": grid_data,
                "interaction_data": {"roi_region": invalid_val},
                "properties": {"mode": "remove_obstacles", "noise_size": 0.10}
            }
            res = gen.generate_layer(context)
            self.assertIn("image_base64", res)


if __name__ == '__main__':
    unittest.main()
