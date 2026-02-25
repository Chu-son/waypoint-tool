import sys
import os
import math

# Ensure the SDK is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator

class LineGenerator(WaypointGenerator):
    """Generates waypoints along a straight line from a start point.

    The line direction is determined by the start point's orientation (yaw).
    Each waypoint is spaced evenly along this direction.
    """

    def generate(self, context):
        # Extract interaction data (the starting point clicked by the user)
        interaction_data = context.get("interaction_data", {})
        start_point = interaction_data.get("start_point")

        if not start_point:
            return []  # No point defined

        base_x = float(start_point.get("x", 0.0))
        base_y = float(start_point.get("y", 0.0))

        # Convert quaternion to yaw
        qx = float(start_point.get("qx", 0.0))
        qy = float(start_point.get("qy", 0.0))
        qz = float(start_point.get("qz", 0.0))
        qw = float(start_point.get("qw", 1.0))
        yaw = math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz))

        # Extract properties
        props = context.get("properties", {})
        num_points = max(1, int(props.get("num_points", 5)))
        spacing = float(props.get("spacing", 1.0))
        if spacing <= 0.01:
            spacing = 0.01

        cos_y = math.cos(yaw)
        sin_y = math.sin(yaw)

        waypoints = []
        for i in range(num_points):
            distance = i * spacing
            wx = base_x + distance * cos_y
            wy = base_y + distance * sin_y

            waypoints.append({
                "x": round(wx, 6),
                "y": round(wy, 6),
                "yaw": round(yaw, 6),
                "options": {
                    "generated_by": "LineGenerator",
                    "line_index": i
                }
            })

        return waypoints

if __name__ == "__main__":
    LineGenerator().run_from_stdin()
