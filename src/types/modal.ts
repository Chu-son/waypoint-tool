export type ModalType =
  | 'settings'
  | 'export'
  | 'import'
  | 'export_maps'
  | 'shortcuts'
  | 'welcome'
  | 'plugin_data';

export type ModalStack = ModalType[];
