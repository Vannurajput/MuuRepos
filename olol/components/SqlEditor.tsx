import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo } from 'react';
import { format } from 'sql-formatter';
import { Wand2, Copy, Code2, Table, Columns, Key, Type, Braces } from 'lucide-react';
import { DbSchema } from '../types';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dbType?: string; 
  schema?: DbSchema;
}

export interface SqlEditorRef {
  getSelection: () => { start: number; end: number; text: string };
  focus: () => void;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 
  'INNER', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'AND', 'OR', 'NOT', 'IN', 'IS', 
  'NULL', 'AS', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'VALUES', 'DISTINCT', 'HAVING',
  'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'RANK', 'DENSE_RANK', 'ROW_NUMBER', 
  'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];

const SqlEditor = forwardRef<SqlEditorRef, SqlEditorProps>(({ value, onChange, disabled, dbType = 'sql', schema }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ 
    x: 0, y: 0, visible: false 
  });

  // IntelliSense State
  const [suggestions, setSuggestions] = useState<{ label: string, type: 'keyword' | 'table' | 'column' }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentWord, setCurrentWord] = useState('');

  useImperativeHandle(ref, () => ({
    getSelection: () => {
      const el = textareaRef.current;
      if (!el) return { start: 0, end: 0, text: '' };
      return { start: el.selectionStart, end: el.selectionEnd, text: el.value.substring(el.selectionStart, el.selectionEnd) };
    },
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
      setShowSuggestions(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  const updateSuggestions = () => {
    const el = textareaRef.current;
    if (!el) return;

    const cursor = el.selectionStart;
    const textBefore = el.value.substring(0, cursor);
    const lastWordMatch = textBefore.match(/[\w$.]+$/);
    
    // Detect trigger for dot IntelliSense (e.g., s.)
    const isDotTrigger = textBefore.endsWith('.');
    const wordSearchText = isDotTrigger ? textBefore.slice(0, -1) : textBefore;
    const triggerWordMatch = wordSearchText.match(/[\w$]+$/);

    if ((!lastWordMatch && !isDotTrigger) || disabled) {
      setShowSuggestions(false);
      return;
    }

    const fullMatch = lastWordMatch ? lastWordMatch[0] : (triggerWordMatch ? triggerWordMatch[0] + '.' : '');
    const parts = fullMatch.split('.');
    const word = isDotTrigger ? '' : parts[parts.length - 1];
    
    setCurrentWord(word);
    
    let filteredList: { label: string, type: 'keyword' | 'table' | 'column' }[] = [];

    // Advanced Alias and Subquery Resolution
    if (parts.length > 1 || isDotTrigger) {
      const aliasOrTable = parts[parts.length - (isDotTrigger ? 1 : 2)];
      const fullSql = el.value;
      
      // Look for: FROM table alias, FROM (subquery) alias, WITH alias AS
      const aliasRegex = new RegExp(`(?:FROM|JOIN)\\s+(?:(?:\\(([^)]+)\\))|["\`]?([\\w$]+)["\`]?)\\s+(?:AS\\s+)?${aliasOrTable}\\b|WITH\\s+${aliasOrTable}\\s+AS`, 'i');
      const aliasMatch = fullSql.match(aliasRegex);
      
      let targetTable = '';
      if (aliasMatch) {
        if (aliasMatch[2]) {
          // It's a direct table alias
          targetTable = aliasMatch[2];
        } else if (aliasMatch[1]) {
          // It's a subquery alias. Try to find the inner-most table mentioned.
          const innerFromMatch = aliasMatch[1].match(/FROM\s+["\`]?([\w$]+)["\`]?/i);
          if (innerFromMatch) targetTable = innerFromMatch[1];
        }
      } else {
        targetTable = aliasOrTable;
      }
      
      const tableDef = schema?.tables.find(t => t.name.toLowerCase() === targetTable.toLowerCase());
      
      if (tableDef) {
        filteredList = tableDef.columns
          .map(c => ({ label: c.name, type: 'column' as const }))
          .filter(c => c.label.toLowerCase().startsWith(word.toLowerCase()));
      } else {
        // Fallback: if we can't find the specific table, suggest all available columns
        filteredList = (schema?.tables || [])
          .flatMap(t => t.columns.map(c => ({ label: c.name, type: 'column' as const })))
          .filter(c => c.label.toLowerCase().startsWith(word.toLowerCase()));
      }
    } else {
      const tables = (schema?.tables || []).map(t => ({ label: t.name, type: 'table' as const }));
      const columns = (schema?.tables || []).flatMap(t => t.columns.map(c => ({ label: c.name, type: 'column' as const })));
      const keywords = SQL_KEYWORDS.map(k => ({ label: k, type: 'keyword' as const }));
      
      filteredList = [...tables, ...columns, ...keywords]
        .filter(item => item.label.toLowerCase().startsWith(word.toLowerCase()));
    }

    if (filteredList.length > 0) {
      // De-duplicate if multiple tables have same column names
      const seen = new Set();
      const unique = filteredList.filter(item => {
        const k = `${item.type}:${item.label}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      setSuggestions(unique.slice(0, 15));
      setSelectedIndex(0);
      setShowSuggestions(true);
      calculateCursorPos(cursor);
    } else {
      setShowSuggestions(false);
    }
  };

  const calculateCursorPos = (cursorIdx: number) => {
    const el = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;

    const textBefore = el.value.substring(0, cursorIdx);
    mirror.textContent = textBefore;
    
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    const { offsetTop, offsetLeft } = span;
    setSuggestionPos({ 
      top: offsetTop - el.scrollTop + 20, 
      left: Math.min(offsetLeft - el.scrollLeft, el.clientWidth - 200) 
    });
  };

  const insertSuggestion = (suggestion: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const cursor = el.selectionStart;
    const before = el.value.substring(0, cursor - currentWord.length);
    const after = el.value.substring(cursor);
    
    const newValue = before + suggestion + after;
    onChange(newValue);
    setShowSuggestions(false);
    
    setTimeout(() => {
      el.focus();
      const newPos = before.length + suggestion.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex].label);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const mapDbTypeToDialect = (type: string) => {
    switch (type) {
      case 'postgres': return 'postgresql';
      case 'mysql': return 'mysql';
      case 'sqlite': return 'sqlite';
      case 'mssql': return 'transactsql';
      default: return 'sql';
    }
  };

  const formatQuery = (onlySelection: boolean) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const fullText = el.value;
    const selectedText = fullText.substring(start, end);
    
    try {
      const dialect = mapDbTypeToDialect(dbType);
      if (onlySelection && selectedText.trim().length > 0) {
        const formattedSelection = format(selectedText, { language: dialect, tabWidth: 2, keywordCase: 'upper' });
        onChange(fullText.substring(0, start) + formattedSelection + fullText.substring(end));
      } else {
        onChange(format(fullText, { language: dialect, tabWidth: 2, keywordCase: 'upper' }));
      }
    } catch (e) { console.error("Format error", e); }
  };

  const highlightedHTML = useMemo(() => {
    if (!value) return '<br/>';
    let safeText = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const combinedRegex = /(&lt;!--[\s\S]*?--&gt;|--.*$|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'|"[^"]*")|(\b\d+(?:\.\d+)?\b)|(\bAS\b\s+[\w$]+)|(\bWITH\b\s+[\w$]+)|(\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|AND|OR|NOT|IN|IS|NULL|AS|CASE|WHEN|THEN|ELSE|END|CREATE|TABLE|DROP|ALTER|VIEW|INDEX|VALUES|SET|DISTINCT|HAVING|UNION|ALL|EXISTS|LIKE|BETWEEN|CAST|CONVERT|WITH|RECURSIVE|OVER|PARTITION|ROWS|UNBOUNDED|PRECEDING|FOLLOWING)\b)|(\b(?:COUNT|SUM|AVG|MIN|MAX|COALESCE|DATE|NOW|GETDATE|ROUND|UPPER|LOWER|SUBSTRING|TRIM|RANK|DENSE_RANK|ROW_NUMBER)\b)|([\(\)])/gim;
    
    return safeText.replace(combinedRegex, (match, comment, str, num, alias, cte, kw, fn, br) => {
        if (comment) return `<span class="text-slate-500 italic">${comment}</span>`;
        if (str) return `<span class="text-green-400">${str}</span>`;
        if (num) return `<span class="text-orange-300 font-mono">${num}</span>`;
        if (alias) {
          const parts = match.split(/\s+/);
          return `<span class="text-blue-400 font-black">${parts[0]}</span> <span class="text-pink-400 italic font-bold">${parts[1]}</span>`;
        }
        if (cte) {
          const parts = match.split(/\s+/);
          return `<span class="text-blue-400 font-black">${parts[0]}</span> <span class="text-pink-400 italic font-bold">${parts[1]}</span>`;
        }
        if (kw) return `<span class="text-blue-400 font-black">${match}</span>`;
        if (fn) return `<span class="text-purple-400 font-semibold">${match}</span>`;
        if (br) return `<span class="text-amber-500 font-bold">${br}</span>`;
        return match;
    }) + '<br/>';
  }, [value]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full font-mono text-sm bg-slate-900 overflow-hidden group shadow-inner"
      onContextMenu={handleContextMenu}
    >
      <div 
        ref={mirrorRef} 
        className="absolute inset-0 p-4 m-0 invisible whitespace-pre-wrap break-all overflow-hidden font-mono text-sm leading-relaxed"
        aria-hidden="true"
      />

      <pre
        ref={preRef}
        className="absolute inset-0 p-4 m-0 pointer-events-none whitespace-pre-wrap break-all overflow-hidden z-0 bg-slate-900 leading-relaxed tracking-normal"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlightedHTML }}
      />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTimeout(updateSuggestions, 0);
        }}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => { if(['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) setShowSuggestions(false); }}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        className="relative z-10 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none focus:outline-none focus:ring-0 leading-relaxed whitespace-pre-wrap break-all overflow-auto selection:bg-blue-500/25"
        placeholder="WITH summary AS (...) SELECT * FROM summary;"
      />

      {showSuggestions && (
        <div 
          style={{ top: suggestionPos.top, left: suggestionPos.left }}
          className="absolute z-[60] min-w-[220px] bg-slate-850 border border-slate-700 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-75 backdrop-blur-md"
        >
          <div className="bg-slate-800 px-2 py-1 text-[9px] font-black text-slate-500 border-b border-slate-700">SUGGESTIONS</div>
          {suggestions.map((s, i) => (
            <div 
              key={i}
              onClick={() => insertSuggestion(s.label)}
              className={`px-3 py-2 flex items-center space-x-2 cursor-pointer text-[11px] font-mono transition-colors ${selectedIndex === i ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              {s.type === 'table' && <Table size={12} className="text-blue-400" />}
              {s.type === 'column' && <Columns size={12} className="text-purple-400" />}
              {s.type === 'keyword' && <Key size={12} className="text-orange-400" />}
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {contextMenu.visible && (
        <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-[100] w-52 bg-slate-850 border border-slate-700 rounded shadow-2xl overflow-hidden py-1 backdrop-blur-md">
          <button onClick={() => formatQuery(true)} className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors">
            <Braces size={14} className="text-blue-400" /> <span>Beautify Selection</span>
          </button>
          <button onClick={() => formatQuery(false)} className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors">
            <Wand2 size={14} className="text-purple-400" /> <span>Standard Format (DBA)</span>
          </button>
        </div>
      )}
    </div>
  );
});

SqlEditor.displayName = 'SqlEditor';
export default SqlEditor;