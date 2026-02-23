import sys
import os

# Ensure the SDK is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator

class GridSweepGenerator(WaypointGenerator):
    def generate(self, context):
        # Extract interaction data (the drawn rectangle)
        interaction_data = context.get("interaction_data", {})
        sweep_area = interaction_data.get("sweep_area")
        
        if not sweep_area:
            return [] # No area defined
            
        min_pt = sweep_area.get("min", {"x": 0.0, "y": 0.0})
        max_pt = sweep_area.get("max", {"x": 10.0, "y": 10.0})
        
        # Extract properties (e.g. spacing)
        props = context.get("properties", {})
        spacing = float(props.get("spacing", 1.0))
        if spacing <= 0.05:
            spacing = 0.05
            
        waypoints = []
        x = min_pt["x"]
        
        # Simple loop to generate a grid of points
        while x <= max_pt["x"]:
            y = min_pt["y"]
            direction = 1 # Alternate Y direction to make a snake pattern
            if int((x - min_pt["x"]) / spacing) % 2 == 1:
                direction = -1
                y = max_pt["y"]
                
            while (min_pt["y"] <= y <= max_pt["y"]):
                waypoints.append({
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "yaw": 0.0,
                    "options": {
                        "generated_by": "GridSweepPlugin"
                    }
                })
                y += spacing * direction
                
            x += spacing
            
        return waypoints

if __name__ == "__main__":
    GridSweepGenerator().run_from_stdin()
