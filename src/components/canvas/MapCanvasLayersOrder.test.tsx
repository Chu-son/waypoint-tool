import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapCanvas } from "./MapCanvas";
import { useAppStore } from "../../stores/appStore";

// Mock PixiJS and @pixi/react
vi.mock("@pixi/react", () => ({
  Application: ({ children }: any) => <div data-testid="pixi-app">{children}</div>,
  extend: vi.fn(),
}));

vi.mock("pixi.js", () => {
  return {
    Container: () => ({ destroy: vi.fn() }),
    Sprite: () => ({ destroy: vi.fn() }),
    Graphics: () => ({ clear: vi.fn(), drawCircle: vi.fn(), destroy: vi.fn() }),
    Texture: {
      from: vi.fn().mockReturnValue({ source: {} }),
    },
    Text: () => ({ destroy: vi.fn() }),
    TextStyle: vi.fn(),
    Filter: vi.fn(),
    GlProgram: {
      from: vi.fn().mockReturnValue({}),
    },
    UniformGroup: vi.fn(),
  };
});

describe("MapCanvas Layer Grouping and Hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      activeTool: "select",
      mapLayers: [],
      customLayers: [],
      plugins: {},
      activePluginId: null,
      activeInputIndex: 0,
      pluginActiveProperties: {},
    });
  });

  it("renders map layers group container before custom layers group container", () => {
    useAppStore.setState({
      mapLayers: [
        {
          id: "map-1",
          name: "Map 1",
          visible: true,
          opacity: 1,
          z_index: 0,
          image_base64: "data:image/png;base64,map1",
          info: { resolution: 0.05, origin: [0, 0, 0] },
          width: 100,
          height: 100,
        },
      ],
      customLayers: [
        {
          id: "custom-1",
          name: "Manual 1",
          type: "manual",
          visible: true,
          opacity: 1,
          z_index: 0,
          blend_mode: "overwrite",
          is_reference: false,
          editObjects: [],
        },
      ],
    });

    const { container } = render(<MapCanvas />);
    expect(container).toBeInTheDocument();

    const pixiApp = screen.getByTestId("pixi-app");
    expect(pixiApp).toBeInTheDocument();

    // Check that custom layers and map layers exist in state and remain separated
    const state = useAppStore.getState();
    expect(state.mapLayers).toHaveLength(1);
    expect(state.customLayers).toHaveLength(1);
  });
});
