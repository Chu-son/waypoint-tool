import { describe, it, expect } from "vitest";
import { prepareLayersForExport } from "./mapRasterize";
import { ProjectMapLayer, ManualCustomLayer, PluginCustomLayer } from "../types/store";

describe("prepareLayersForExport ordering and z_index tests", () => {
  it("assigns higher z_index to higher layers in list, and custom layers always have z_index >= 1000", async () => {
    const mockMapLayers: ProjectMapLayer[] = [
      {
        id: "map-top",
        name: "Top Map",
        info: { resolution: 0.05, origin: [0, 0, 0] },
        image_base64: "data:image/png;base64,top",
        width: 100,
        height: 100,
        visible: true,
        opacity: 1.0,
        z_index: 0,
      },
      {
        id: "map-bottom",
        name: "Bottom Map",
        info: { resolution: 0.05, origin: [0, 0, 0] },
        image_base64: "data:image/png;base64,bottom",
        width: 100,
        height: 100,
        visible: true,
        opacity: 1.0,
        z_index: 1,
      },
    ];

    const mockCustomLayers: (ManualCustomLayer | PluginCustomLayer)[] = [
      {
        id: "custom-top",
        name: "Top Custom Plugin",
        type: "plugin",
        plugin_id: "test",
        params: {},
        image_base64: "data:image/png;base64,custom-top",
        info: { resolution: 0.05, origin: [0, 0, 0], width: 100, height: 100 },
        visible: true,
        opacity: 1.0,
        z_index: 0,
      },
      {
        id: "custom-bottom",
        name: "Bottom Custom Plugin",
        type: "plugin",
        plugin_id: "test",
        params: {},
        image_base64: "data:image/png;base64,custom-bottom",
        info: { resolution: 0.05, origin: [0, 0, 0], width: 100, height: 100 },
        visible: true,
        opacity: 1.0,
        z_index: 1,
      },
    ];

    const result = await prepareLayersForExport(mockMapLayers, mockCustomLayers);

    const mapTop = result.find(l => l.id === "map-top")!;
    const mapBottom = result.find(l => l.id === "map-bottom")!;
    const customTop = result.find(l => l.id === "custom-top")!;
    const customBottom = result.find(l => l.id === "custom-bottom")!;

    // 1. Map Layers ordering: top in list has higher z_index than bottom in list
    expect(mapTop.z_index).toBe(1);
    expect(mapBottom.z_index).toBe(0);
    expect(mapTop.z_index).toBeGreaterThan(mapBottom.z_index);

    // 2. Custom Layers ordering: top in list has higher z_index than bottom in list
    expect(customTop.z_index).toBe(1001);
    expect(customBottom.z_index).toBe(1000);
    expect(customTop.z_index).toBeGreaterThan(customBottom.z_index);

    // 3. Custom Layers are always strictly greater than all Map Layers
    expect(customBottom.z_index).toBeGreaterThan(mapTop.z_index);
  });

  it("updates z_index correctly when layers are reordered", async () => {
    const mockMapLayers: ProjectMapLayer[] = [
      {
        id: "map-1",
        name: "Map 1",
        info: { resolution: 0.05, origin: [0, 0, 0] },
        image_base64: "data:image/png;base64,1",
        width: 100,
        height: 100,
        visible: true,
        opacity: 1.0,
        z_index: 0,
      },
      {
        id: "map-2",
        name: "Map 2",
        info: { resolution: 0.05, origin: [0, 0, 0] },
        image_base64: "data:image/png;base64,2",
        width: 100,
        height: 100,
        visible: true,
        opacity: 1.0,
        z_index: 1,
      },
    ];

    // Initial order: [map-1, map-2]
    const res1 = await prepareLayersForExport(mockMapLayers, []);
    expect(res1.find(l => l.id === "map-1")!.z_index).toBe(1);
    expect(res1.find(l => l.id === "map-2")!.z_index).toBe(0);

    // Reordered: [map-2, map-1]
    const reorderedMapLayers = [mockMapLayers[1], mockMapLayers[0]];
    const res2 = await prepareLayersForExport(reorderedMapLayers, []);
    expect(res2.find(l => l.id === "map-2")!.z_index).toBe(1);
    expect(res2.find(l => l.id === "map-1")!.z_index).toBe(0);
  });
});
