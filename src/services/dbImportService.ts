import { z } from 'zod';
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

// Frontend validation schema (mirrors backend DbImportExecuteSchema for early UX feedback)
const DbImportTableSelectionSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/, 'Недопустимое имя таблицы'),
  strategy: z.enum(['replace', 'merge', 'append']),
});

const DbImportExecuteInputSchema = z.object({
  filePath: z.string().min(1).refine(
    (p) => /\.(db|sqlite|sqlite3)$/i.test(p),
    'Файл должен иметь расширение .db, .sqlite или .sqlite3'
  ),
  tables: z.array(DbImportTableSelectionSchema).min(1).max(50),
});

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
  const parsed = DbImportExecuteInputSchema.safeParse({ filePath, tables });
  if (!parsed.success) {
    const message = parsed.error.errors.map(e => e.message).join('; ');
    return { success: false, error: message };
  }
  return window.electronAPI.executeDbImport(filePath, tables);
}

export const dbImportService = {
  selectDbFile,
  getTablesFromFile,
  executeImport,
};
