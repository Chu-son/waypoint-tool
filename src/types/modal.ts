export type ModalType = 'settings' | 'export' | 'import' | 'export_maps' | 'shortcuts' | 'welcome' | 'plugin_data';

export type ModalStack = ModalType[];

/** インポートの入口（`ImportHubModal`）で選べる、取り込む対象の種類。 */
export type ImportCategory = 'waypoints' | 'optionSchema' | 'template' | 'map' | 'plugins' | 'project';
