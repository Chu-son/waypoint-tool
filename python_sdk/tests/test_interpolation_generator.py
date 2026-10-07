"""Tests for the InterpolationGenerator plugin."""
import math
import sys
import os
import unittest
import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

_spec = importlib.util.spec_from_file_location(
    'interpolation_main', os.path.join(_parent, 'interpolation_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
InterpolationGenerator = _mod.InterpolationGenerator


def _node(node_id, x, y, name=None, options=None, z=0.0, group_path=None):
    return {
        "id": node_id,
        "name": name,
        "transform": {"x": x, "y": y, "z": z, "qx": 0.0, "qy": 0.0, "qz": 0.0, "qw": 1.0},
        "options": options,
        "group_path": group_path or [],
    }


def _context(nodes, **properties):
    return {"properties": properties, "waypoint_range": nodes}


def _run(nodes, **properties):
    return InterpolationGenerator().generate(_context(nodes, **properties)).to_dict()["waypoints"]["items"]


def _xy(wp):
    return wp["transform"]["x"], wp["transform"]["y"]


class TestInterpolationGenerator(unittest.TestCase):

    def test_every_gap_is_at_most_max_pitch(self):
        nodes = [_node("a", 0, 0), _node("b", 3.4, 0), _node("c", 3.4, 2.1)]
        points = [_xy(wp) for wp in _run(nodes, max_pitch=0.5)]

        for p, q in zip(points, points[1:]):
            self.assertLessEqual(math.dist(p, q), 0.5 + 1e-6)

    def test_original_waypoints_keep_position_name_and_options(self):
        nodes = [_node("a", 0, 0, name="Start", options={"stop": True}), _node("b", 2, 0, name="End")]
        items = _run(nodes, max_pitch=1.0)

        originals = [wp for wp in items if wp["stash_key"].startswith("orig:")]
        self.assertEqual([_xy(wp) for wp in originals], [(0, 0), (2, 0)])
        self.assertEqual([wp.get("name") for wp in originals], ["Start", "End"])
        self.assertEqual(originals[0]["options"], {"stop": True})
        self.assertNotIn("options", originals[1])

    def test_original_pose_is_passed_through_unchanged(self):
        tilted = _node("a", 0, 0, z=1.5)
        tilted["transform"].update({"qx": 0.1, "qy": 0.2, "qz": 0.3, "qw": 0.9})
        items = _run([tilted, _node("b", 2, 0)], max_pitch=1.0)

        self.assertEqual(items[0]["transform"], tilted["transform"])

    def test_disabled_outputs_exactly_the_original_waypoints(self):
        nodes = [_node("a", 0, 0, name="A"), _node("b", 5, 0, name="B"), _node("c", 5, 5)]
        items = _run(nodes, max_pitch=0.5, enabled=False)

        self.assertEqual([wp["transform"] for wp in items], [n["transform"] for n in nodes])
        self.assertEqual([wp["stash_key"] for wp in items], ["orig:0", "orig:1", "orig:2"])

    def test_interpolated_points_have_no_options_and_face_the_travel_direction(self):
        items = _run([_node("a", 0, 0, options={"stop": True}), _node("b", 0, 2)], max_pitch=1.0)

        mid = items[1]
        self.assertEqual(mid["stash_key"], "seg:0:1/2")
        self.assertNotIn("options", mid)
        self.assertAlmostEqual(mid["transform"]["qz"], math.sin(math.pi / 4), places=5)

    def test_stash_keys_are_unique_and_stable_across_pitch_changes_for_originals(self):
        nodes = [_node("a", 0, 0), _node("b", 4, 0), _node("c", 8, 0)]
        coarse = [wp["stash_key"] for wp in _run(nodes, max_pitch=2.0)]
        fine = [wp["stash_key"] for wp in _run(nodes, max_pitch=1.0)]

        for keys in (coarse, fine):
            self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual([k for k in coarse if k.startswith("orig:")], ["orig:0", "orig:1", "orig:2"])
        self.assertEqual([k for k in fine if k.startswith("orig:")], ["orig:0", "orig:1", "orig:2"])

    def test_does_not_split_a_segment_that_already_fits(self):
        items = _run([_node("a", 0, 0), _node("b", 0.4, 0)], max_pitch=0.5)
        self.assertEqual(len(items), 2)

    def test_exact_multiple_does_not_add_an_extra_split(self):
        items = _run([_node("a", 0, 0), _node("b", 1.1, 0)], max_pitch=0.1)
        self.assertEqual(len(items), 12)  # 11 segments -> 10 interior points + 2 ends

    def test_coincident_points_are_not_split(self):
        items = _run([_node("a", 1, 1), _node("b", 1, 1)], max_pitch=0.1)
        self.assertEqual(len(items), 2)

    def test_z_is_interpolated_linearly(self):
        items = _run([_node("a", 0, 0, z=0.0), _node("b", 2, 0, z=1.0)], max_pitch=1.0)
        self.assertAlmostEqual(items[1]["transform"]["z"], 0.5)

    def test_legacy_pitch_property_is_still_read(self):
        items = _run([_node("a", 0, 0), _node("b", 2, 0)], pitch=1.0)
        self.assertEqual(len(items), 3)

    def test_fewer_than_two_waypoints_yields_no_output(self):
        result = InterpolationGenerator().generate(_context([_node("a", 0, 0)], max_pitch=1.0)).to_dict()
        self.assertNotIn("waypoints", result)

    def _grouped_range(self):
        # a (outside) -- g1 -- g2 (both in group "grp") -- b (outside), each 4 m apart
        return [
            _node("a", 0, 0),
            _node("g1", 4, 0, group_path=["grp"]),
            _node("g2", 8, 0, group_path=["grp"]),
            _node("b", 12, 0),
        ]

    def test_groups_are_interpolated_by_default(self):
        items = _run(self._grouped_range(), max_pitch=2.0)
        self.assertEqual(len(items), 4 + 3)  # every 4 m segment gets one midpoint

    def test_groups_are_interpolated_when_included(self):
        items = _run(self._grouped_range(), max_pitch=2.0, include_groups=True)
        self.assertEqual(len(items), 4 + 3)

    def test_segments_inside_a_group_are_not_split_when_groups_are_excluded(self):
        items = _run(self._grouped_range(), max_pitch=2.0, include_groups=False)

        keys = [wp["stash_key"] for wp in items]
        # the a->g1 and g2->b joints are still split; g1->g2 (same group) is left alone
        self.assertEqual(keys, ["orig:0", "seg:0:1/2", "orig:1", "orig:2", "seg:2:1/2", "orig:3"])

    def test_points_of_the_group_are_still_output_when_groups_are_excluded(self):
        items = _run(self._grouped_range(), max_pitch=2.0, include_groups=False)
        xs = [_xy(wp)[0] for wp in items if wp["stash_key"].startswith("orig:")]
        self.assertEqual(xs, [0, 4, 8, 12])

    def test_different_groups_are_joined_by_a_split_segment_when_groups_are_excluded(self):
        nodes = [_node("a", 0, 0, group_path=["g_one"]), _node("b", 4, 0, group_path=["g_two"])]
        items = _run(nodes, max_pitch=2.0, include_groups=False)
        self.assertEqual(len(items), 3)

    def test_missing_waypoint_range_yields_no_output(self):
        result = InterpolationGenerator().generate({"properties": {}}).to_dict()
        self.assertNotIn("waypoints", result)


if __name__ == "__main__":
    unittest.main()
