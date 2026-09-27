import { describe, it, expect, beforeEach } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { layerStackState, makeManualCustomLayer, makeMap } from '../../test/fixtures';

describe('map layer stack', () => {
  beforeEach(() => resetAppStore());

  it('puts a newly added layer of any kind on top of the stack', () => {
    getAppState().addMapLayer('Map', { resolution: 0.05 }, 'img', 10, 10);
    const wall = getAppState().addManualCustomLayer('Wall');
    getAppState().addMapLayer('Map 2', { resolution: 0.05 }, 'img2', 10, 10);

    const { layerOrder, mapLayers } = getAppState();
    expect(layerOrder).toHaveLength(3);
    expect(layerOrder[0]).toBe(mapLayers[0].id);
    expect(layerOrder[1]).toBe(wall.id);
  });

  it('duplicates a map right above the original, sharing its source and copying its clip', () => {
    resetAppStore(
      layerStackState(makeMap('a', { clip: { rects: [{ x: 0, y: 0, width: 1, height: 1 }] } }), makeMap('b')),
    );

    const copyId = getAppState().duplicateMapLayer('b');

    const { mapLayers, mapSources, layerOrder } = getAppState();
    expect(layerOrder).toEqual(['a', copyId, 'b']);
    expect(mapSources).toHaveLength(2);
    expect(mapLayers.find((l) => l.id === copyId)?.sourceId).toBe('b-source');

    // Editing the copy's clip does not touch the original's.
    const aCopyId = getAppState().duplicateMapLayer('a')!;
    getAppState().updateMapLayer(aCopyId, { clip: { rects: [{ x: 5, y: 5, width: 1, height: 1 }] } });
    expect(getAppState().mapLayers.find((l) => l.id === 'a')?.clip?.rects[0].x).toBe(0);
  });

  it('returns null when asked to duplicate a map that does not exist', () => {
    expect(getAppState().duplicateMapLayer('nope')).toBeNull();
  });

  it('changes the pose of every copy by editing the shared source once', () => {
    resetAppStore(layerStackState(makeMap('a', { info: { origin: [0, 0, 0] } })));
    getAppState().duplicateMapLayer('a');

    getAppState().updateMapSource('a-source', { info: { ...getAppState().mapSources[0].info, origin: [3, 4, 0] } });

    expect(getAppState().mapSources).toHaveLength(1);
    expect(getAppState().mapSources[0].info.origin).toEqual([3, 4, 0]);
  });

  it('keeps a removed custom layer out of the stack, and brings it back with undo', () => {
    resetAppStore(layerStackState(makeMap('a'), makeManualCustomLayer('wall'), makeMap('b')));

    getAppState().pushHistorySnapshot();
    getAppState().removeCustomLayer('wall');
    expect(getAppState().layerOrder).toEqual(['a', 'b']);

    getAppState().undo();
    expect(getAppState().layerOrder).toEqual(['a', 'wall', 'b']);

    getAppState().redo();
    expect(getAppState().layerOrder).toEqual(['a', 'b']);
  });

  it('keeps maps added after a history snapshot in the stack when undoing', () => {
    resetAppStore(layerStackState(makeManualCustomLayer('wall')));
    getAppState().pushHistorySnapshot();
    getAppState().addMapLayer('Late', { resolution: 0.05 }, 'img', 10, 10);
    getAppState().updateCustomLayer('wall', { opacity: 0.5 });

    getAppState().undo();

    expect(getAppState().customLayers[0].opacity).toBe(1);
    expect(getAppState().layerOrder).toHaveLength(2);
    expect(getAppState().layerOrder).toContain(getAppState().mapLayers[0].id);
  });
});

describe('reshaping a use area with a drag', () => {
  const left = { rects: [{ x: 0, y: 0, width: 5, height: 10 }] };
  const clipOf = (id: string) => getAppState().mapLayers.find((l) => l.id === id)?.clip;

  beforeEach(() => resetAppStore(layerStackState(makeMap('a', { clip: left }))));

  it('makes a whole drag one undo step', () => {
    getAppState().beginMapClipDrag('a');
    getAppState().updateMapClipDrag({ rects: [{ x: 0, y: 0, width: 6, height: 10 }] });
    getAppState().updateMapClipDrag({ rects: [{ x: 0, y: 0, width: 8, height: 10 }] });
    getAppState().endMapClipDrag();
    expect(clipOf('a')?.rects[0].width).toBe(8);

    getAppState().undo();

    expect(clipOf('a')).toEqual(left);
  });

  it('restores the area and leaves no history when the drag is cancelled', () => {
    const undoDepth = getAppState().historyPast.length;

    getAppState().beginMapClipDrag('a');
    getAppState().updateMapClipDrag({ rects: [{ x: 1, y: 1, width: 1, height: 1 }] });
    getAppState().cancelMapClipDrag();

    expect(clipOf('a')).toEqual(left);
    expect(getAppState().historyPast).toHaveLength(undoDepth);
  });

  it('restores "no clip" when a drag that enabled the clip is cancelled', () => {
    resetAppStore(layerStackState(makeMap('a')));

    getAppState().beginMapClipDrag('a');
    getAppState().updateMapClipDrag(left);
    getAppState().cancelMapClipDrag();

    expect(clipOf('a')).toBeNull();
  });

  it('leaves no undo step when the drag changed nothing, and keeps the redo history', () => {
    getAppState().updateMapLayer('a', { opacity: 0.5 });
    getAppState().pushHistorySnapshot();
    getAppState().undo();
    expect(getAppState().historyFuture).toHaveLength(1);
    const undoDepth = getAppState().historyPast.length;

    getAppState().beginMapClipDrag('a');
    getAppState().endMapClipDrag();

    expect(getAppState().historyPast).toHaveLength(undoDepth);
    expect(getAppState().historyFuture).toHaveLength(1);
  });

  it('undoes and redoes a use area change without touching maps added since', () => {
    getAppState().pushHistorySnapshot();
    getAppState().updateMapLayer('a', { clip: null });
    getAppState().addMapLayer('Late', { resolution: 0.05 }, 'img', 10, 10);

    getAppState().undo();
    expect(clipOf('a')).toEqual(left);
    expect(getAppState().mapLayers).toHaveLength(2);

    getAppState().redo();
    expect(clipOf('a')).toBeNull();
    expect(getAppState().mapLayers).toHaveLength(2);
  });

  it('ignores updates outside a drag', () => {
    getAppState().updateMapClipDrag({ rects: [{ x: 9, y: 9, width: 1, height: 1 }] });

    expect(clipOf('a')).toEqual(left);
  });
});
