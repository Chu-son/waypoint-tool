"""Tests for custom_layer plugin inputs and helpers."""
import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import WaypointGenerator, Waypoint


class DummyPlugin(WaypointGenerator):
    def generate(self, context):
        return []


class TestCustomLayerPluginInput(unittest.TestCase):
    def test_get_custom_layer_single(self):
        plugin = DummyPlugin()
        context = {
            "interaction_data": {
                "obstacle_layer": {
                    "id": "cl-1",
                    "name": "Custom Obstacles",
                    "type": "manual",
                    "opacity": 1.0,
                    "edit_objects": [
                        {"type": "rect", "cx": 2.0, "cy": 3.0, "width": 1.0, "height": 1.0, "fillValue": 0}
                    ]
                }
            }
        }
        layer = plugin.get_custom_layer(context, "obstacle_layer")
        self.assertIsNotNone(layer)
        self.assertEqual(layer["name"], "Custom Obstacles")
        self.assertEqual(len(layer["edit_objects"]), 1)

    def test_get_custom_layers_multiple(self):
        plugin = DummyPlugin()
        context = {
            "interaction_data": {
                "layers": [
                    {"id": "cl-1", "name": "Layer 1", "type": "manual"},
                    {"id": "cl-2", "name": "Layer 2", "type": "plugin"},
                ]
            }
        }
        layers = plugin.get_custom_layers(context, "layers")
        self.assertEqual(len(layers), 2)
        self.assertEqual(layers[0]["name"], "Layer 1")
        self.assertEqual(layers[1]["name"], "Layer 2")

    def test_get_custom_layer_empty(self):
        plugin = DummyPlugin()
        context = {"interaction_data": {}}
        self.assertIsNone(plugin.get_custom_layer(context, "non_existent"))
        self.assertEqual(plugin.get_custom_layers(context, "non_existent"), [])


if __name__ == '__main__':
    unittest.main()
