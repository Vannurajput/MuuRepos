// FIX: Corrected import path for LanguageSupport to point to the root types file.
import { LanguageSupport } from "../../types";

export const sql: LanguageSupport = {
    id: 'sql',
    name: 'SQL',
    keywords: [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 
        'CREATE', 'DATABASE', 'TABLE', 'INDEX', 'ALTER', 'DROP', 'PRIMARY', 'KEY', 'FOREIGN', 
        'UNIQUE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'ON', 'GROUP', 'BY', 'HAVING', 
        'ORDER', 'ASC', 'DESC', 'AS', 'IS', 'NULL', 'NOT', 'AND', 'OR', 'LIKE', 'IN', 
        'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'CAST', 'CONVERT'
    ],
    autoClosePairs: [
        ['(', ')'],
        ["'", "'"],
        ['"', '"'],
    ],
};