import type {
  DbImportTableInfo,
  DbImportTableSelection,
  DbImportTableResult,
} from '../types';

export interface GetTablesResult {
  success: boolean;
  tables?: DbImportTableInfo[];
  error?: string;
}

export interface ExecuteImportResult {
  success: boolean;
  results?: DbImportTableResult[];
  error?: string;
}

async function selectDbFile(): Promise<string | null> {
  const result = await window.electronAPI.openFile({
    title: 'Выберите базу данных для импорта',
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

async function getTablesFromFile(filePath: string): Promise<GetTablesResult> {
  return window.electronAPI.getImportDbTables(filePath);
}

async function executeImport(
  filePath: string,
  tables: DbImportTableSelection[]
): Promise<ExecuteImportResult> {
  return window.electronAPI.executeDbImport(filePath, tables);
}

export const dbImportService = {
  selectDbFile,
  getTablesFromFile,
  executeImport,
};
