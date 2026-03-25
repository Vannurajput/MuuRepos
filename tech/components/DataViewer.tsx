import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileTab, TableSchema, QueryResult } from '../types';
import MonacoEditor, { EditorRef } from './MonacoEditor';
import * as duckdb from '@duckdb/duckdb-wasm';

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    try {
        const base64String = dataUrl.split(',')[1];
        if (!base64String) return new Uint8Array(0);
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Failed to convert data URL to Uint8Array", e);
        return new Uint8Array(0);
    }
};

interface DataViewerProps {
    file: FileTab;
}

const DataViewer: React.FC<DataViewerProps> = ({ file }) => {
    const [db, setDb] = useState<any>(null);
    const [dbType, setDbType] = useState<'sqlite' | 'duckdb' | null>(null);
    const [schema, setSchema] = useState<TableSchema[]>([]);
    const [query, setQuery] = useState('SELECT * FROM \'__TABLE_NAME__\' LIMIT 100;');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isQueryRunning, setIsQueryRunning] = useState(false);
    const queryEditorRef = useRef<EditorRef>(null);

    const handleQueryChange = useCallback((_: number, newContent: string) => {
        setQuery(newContent);
    }, []);

    const noOpStateChange = useCallback(() => { }, []);

    useEffect(() => {
        let isCancelled = false;
        let activeDb: any = null;
        let activeDbType: 'sqlite' | 'duckdb' | null = null;
        let workerUrl: string | null = null; // Variable to hold the blob URL

        const initDb = async () => {
            setIsLoading(true);
            setError(null);
            setSchema([]);
            setQueryResult(null);
            setDb(null);
            setDbType(null);

            try {
                const data = dataUrlToUint8Array(file.content);
                if (data.length === 0) throw new Error("File is empty or could not be read.");

                const lang = file.language.toLowerCase();
                let tables: TableSchema[] = [];

                if (lang === 'sqlite' || lang === 'db') {
                    const SQL = await window.initSqlJs({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` });
                    const database = new SQL.Database(data);
                    activeDb = database;
                    activeDbType = 'sqlite';

                    const tablesResult = database.exec("SELECT name FROM sqlite_master WHERE type='table';");
                    if (tablesResult[0]) {
                        const tableNames = tablesResult[0].values.map((row: any) => row[0] as string);
                        for (const tableName of tableNames) {
                            const pragma = database.exec(`PRAGMA table_info(${tableName});`);
                            if (pragma[0]) {
                                const columns = pragma[0].values.map((col: any) => ({ name: col[1], type: col[2] }));
                                tables.push({ name: tableName, columns });
                            }
                        }
                    }
                } else if (lang === 'duckdb' || lang === 'parquet') {
                    const DUCKDB_BUNDLE = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

                    // Create a blob URL for the worker to bypass CORS issues.
                    workerUrl = URL.createObjectURL(
                        new Blob([`importScripts('${DUCKDB_BUNDLE.mainWorker!}');`], { type: 'application/javascript' })
                    );
                    const worker = new Worker(workerUrl);

                    const logger = new duckdb.ConsoleLogger();
                    const database = new duckdb.AsyncDuckDB(logger, worker);
                    await database.instantiate(DUCKDB_BUNDLE.mainModule, DUCKDB_BUNDLE.pthreadWorker);
                    await database.registerFileBuffer(file.name, data);
                    const conn = await database.connect();

                    activeDb = { db: database, conn };
                    activeDbType = 'duckdb';

                    if (lang === 'duckdb') {
                        const tablesResult = await conn.query(`SHOW TABLES;`);
                        const tableNames = tablesResult.toArray().map((t: any) => t.name as string);
                        for (const tableName of tableNames) {
                            const desc = await conn.query(`DESCRIBE ${tableName};`);
                            const columns = desc.toArray().map((c: any) => ({ name: c.column_name, type: c.column_type }));
                            tables.push({ name: tableName, columns });
                        }
                    } else { // parquet
                        const tableName = file.name;
                        const desc = await conn.query(`DESCRIBE SELECT * FROM '${tableName.replace(/'/g, "''")}';`);
                        const columns = desc.toArray().map((c: any) => ({ name: c.column_name, type: c.column_type }));
                        tables.push({ name: tableName, columns });
                    }
                } else {
                    throw new Error(`Unsupported data file type: ${lang}`);
                }

                if (!isCancelled) {
                    setDb(activeDb);
                    setDbType(activeDbType);
                    setSchema(tables);
                    if (tables.length > 0) setQuery(`SELECT * FROM '${tables[0].name.replace(/'/g, "''")}' LIMIT 100;`);
                }

            } catch (e: any) {
                if (!isCancelled) {
                    setError(`Failed to initialize database: ${e.message}`);
                    console.error(e);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        initDb();

        return () => {
            isCancelled = true;
            if (activeDb) {
                if (activeDbType === 'sqlite') {
                    activeDb.close();
                } else if (activeDbType === 'duckdb') {
                    activeDb.conn?.close();
                    activeDb.db?.terminate();
                }
            }
            if (workerUrl) {
                URL.revokeObjectURL(workerUrl);
            }
        };
    }, [file]);

    const handleRunQuery = async () => {
        if (!db || !query.trim()) return;
        setIsQueryRunning(true);
        setError(null);
        setQueryResult(null);
        try {
            let results;
            if (dbType === 'sqlite') {
                results = db.exec(query);
                if (results.length > 0) {
                    setQueryResult(results[0]);
                } else {
                    setQueryResult({ columns: [], values: [] });
                }
            } else if (dbType === 'duckdb') {
                results = await db.conn.query(query);
                const arrowResult = results.toArray();
                const columns = results.schema.fields.map((f: any) => f.name);
                const values = arrowResult.map((row: any) => Object.values(row.toJSON()));
                setQueryResult({ columns, values });
            }
        } catch (e: any) {
            setError(`Query failed: ${e.message}`);
            console.error(e);
        } finally {
            setIsQueryRunning(false);
        }
    };

    const handleTableClick = (tableName: string) => {
        const safeTableName = tableName.replace(/'/g, "''");
        setQuery(`SELECT * FROM '${safeTableName}' LIMIT 100;`);
    };

    if (isLoading) {
        return <div className="p-4 text-gray-400">Initializing Data Viewer...</div>;
    }

    return (
        <div className="flex w-full h-full bg-gray-900">
            <aside className="w-64 flex-shrink-0 bg-gray-800 border-r border-gray-700 p-2 flex flex-col">
                <h3 className="text-sm font-semibold mb-2 p-2 text-gray-300 uppercase tracking-wider">Schema</h3>
                <div className="overflow-y-auto flex-1">
                    {schema.length > 0 ? (
                        <ul>
                            {schema.map(table => (
                                <li key={table.name} className="mb-2">
                                    <button onClick={() => handleTableClick(table.name)} className="w-full text-left p-2 rounded hover:bg-gray-700">
                                        <div className="font-semibold text-white truncate">{table.name}</div>
                                    </button>
                                    <ul className="pl-4 mt-1 font-mono text-xs">
                                        {table.columns.map(col => (
                                            <li key={col.name} className="text-gray-400 truncate"><span className="text-gray-500">{col.name}:</span> {col.type}</li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-xs text-gray-500 p-2">No tables found in schema.</p>}
                </div>
            </aside>
            <main className="flex-1 flex flex-col min-w-0">
                <div className="h-48 flex-shrink-0 border-b border-gray-700 relative p-2">
                    <MonacoEditor
                        ref={queryEditorRef}
                        file={{ content: query, language: 'sql' } as FileTab}
                        onContentChange={handleQueryChange}
                        onStateChange={noOpStateChange}
                        isWordWrapEnabled={true}
                        whitespaceVisibility="none"
                    />
                    <button onClick={handleRunQuery} disabled={isQueryRunning} className="absolute bottom-4 right-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-500">
                        {isQueryRunning ? 'Running...' : 'Run Query'}
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {error && <div className="p-4 text-red-400 bg-red-900/50">{error}</div>}
                    {queryResult ? (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-800 sticky top-0">
                                <tr>
                                    {queryResult.columns.map(col => <th key={col} className="p-2 border-b border-r border-gray-700 text-left font-semibold text-gray-300">{col}</th>)}
                                </tr>
                            </thead>
                            <tbody className="bg-gray-900">
                                {queryResult.values.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-800/50">
                                        {row.map((val, j) => <td key={j} className="p-2 border-b border-r border-gray-700 text-gray-300 font-mono align-top">{val === null ? 'NULL' : String(val)}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : !error && <div className="p-4 text-gray-500">Run a query to see results.</div>}
                </div>
            </main>
        </div>
    );
};

export default DataViewer;