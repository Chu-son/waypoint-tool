import { IDialogAPI, OpenDialogOptions, SaveDialogOptions } from '../types';

export class MockDialogAPI implements IDialogAPI {
  async open(options?: OpenDialogOptions): Promise<string | string[] | null> {
    console.log('[Mock Dialog] open dialog called with options:', options);
    
    if (options?.directory) {
      const defaultPath = window.prompt('Select a directory (mock):', '/mock/path/to/dir');
      return defaultPath || null;
    }
    
    if (options?.multiple) {
      const defaultPath = window.prompt('Select multiple files (mock, comma separated):', '/mock/file1.yaml,/mock/file2.yaml');
      return defaultPath ? defaultPath.split(',') : null;
    }
    
    const defaultPath = window.prompt('Select a file (mock):', '/mock/path/to/file.yaml');
    return defaultPath || null;
  }

  async save(options?: SaveDialogOptions): Promise<string | null> {
    console.log('[Mock Dialog] save dialog called with options:', options);
    const defaultPath = window.prompt('Save file as (mock):', '/mock/path/to/save.yaml');
    return defaultPath || null;
  }

  async ask(message: string, options?: any): Promise<boolean> {
    console.log('[Mock Dialog] ask dialog called:', message, options);
    return window.confirm(`[Mock Ask]\n${message}`);
  }
}
