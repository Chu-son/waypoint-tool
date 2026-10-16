export type ActiveSelection =
  | { type: 'none' }
  | { type: 'nodes'; ids: string[] }
  | { type: 'annotations'; ids: string[] }
  /**
   * Items of the layer tree: map instances, custom layers and layer groups, possibly mixed.
   * `selectedObjectId` is the vector object being edited, only when one hand-drawn layer is selected.
   */
  | { type: 'layers'; ids: string[]; selectedObjectId: string | null };
