export type ActiveSelection =
  | { type: 'none' }
  | { type: 'nodes'; ids: string[] }
  | { type: 'annotations'; ids: string[] }
  | { type: 'custom_layer'; layerId: string; selectedObjectId: string | null };
