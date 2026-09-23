import { IAppAPI, IBackendAPI, IDialogAPI } from './types';
import { TauriBackendAPI } from './backend/tauri';
import { MockBackendAPI } from './backend/mock';
import { TauriDialogAPI } from './dialog/tauri';
import { MockDialogAPI } from './dialog/mock';
import { TauriAppAPI } from './app/tauri';
import { MockAppAPI } from './app/mock';

export const isTauri = () => '__TAURI_INTERNALS__' in window;

export const BackendAPI: IBackendAPI = isTauri() ? new TauriBackendAPI() : new MockBackendAPI();

export const DialogAPI: IDialogAPI = isTauri() ? new TauriDialogAPI() : new MockDialogAPI();

export const AppAPI: IAppAPI = isTauri() ? new TauriAppAPI() : new MockAppAPI();
