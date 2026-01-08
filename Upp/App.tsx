import React, { useState, useEffect, useCallback } from 'react';

// Define the interface for the external message handler
declare global {
  interface Window {
    externalMessage?: {
      send: (message: string) => any;
    };
    // Global helper for the Muul browser to inject results directly
    updateBrowserResult?: (data: any) => void;
  }
}

const PRINT_JSON = {
  "type": "print",
  "payload": {
    "printer_name": ["EPSON TM-m30 Receipt"],
    "item_length": 26,
    "template": "2",
    "data": [
      { "type": "logo", "data": { "url": "https://pos.tradywork.com/images/22bef43a88f72e2a0e57992865302ba4.png" } },
      { "type": "header", "data": { "top_title": "My Store Name", "bill_no": "13355", "date_of_bill": "3/3/2022" } },
      { "type": "item", "data": { "itemdata": [{ "item_name": "Pizza", "quantity": 1, "price": 44.99, "item_amount": 44.99 }] } },
      { "type": "bigsummary", "data": { "bigsummary": [{ "key": "Total", "value": 44.99 }] } },
      { "type": "footer", "data": { "align": "center", "footer_text": ["Thank you for your visit!"] } }
    ]
  }
};

const GIT_TEMPLATE_JSON = {
  "type": "git",
  "payload": { "repo": "my-app", "branch": "main", "action": "deploy" }
};

const DATABASE_JSON = {
  "connectionname": "xys",      
  "sql": "SELECT * FROM public.vandana"
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [resultData, setResultData] = useState<string>('');
  const [isMuulBrowser, setIsMuulBrowser] = useState<boolean>(false);
  
  // Form/File Mode State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commandType, setCommandType] = useState<string>('GIT_ZIP');
  const [credentialId, setCredentialId] = useState<string>('1');
  const [destination, setDestination] = useState<'github' | 'local' | 'both'>('github');
  const [pathInRepo, setPathInRepo] = useState<string>('');

  // Git Pull Specific State
  const [pullRepo, setPullRepo] = useState<string>('');
  const [pullBranch, setPullBranch] = useState<string>('main');

  // Status State
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string; details?: string }>({
    type: 'idle',
    message: ''
  });

  // Detection logic for Muul Browser
  useEffect(() => {
    const detectMuul = () => {
      const hasBridge = !!window.externalMessage;
      const hasCustomUA = navigator.userAgent.includes('Muul') || navigator.userAgent.includes('Electron');
      const detected = hasBridge || hasCustomUA;
      setIsMuulBrowser(detected);
      
      console.log(
        `%c[MUUL DETECTION] Environment: ${detected ? 'MUUL BROWSER' : 'STANDARD BROWSER'} | Bridge: ${hasBridge ? 'FOUND' : 'MISSING'}`,
        `color: white; background: ${detected ? '#10b981' : '#f43f5e'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;`
      );
    };
    detectMuul();
  }, []);

  const performDevToolsLog = useCallback((type: 'SENT' | 'RECEIVED' | 'ERROR', content: any, handlerStatus: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const isMuulOrigin = !!window.externalMessage;
    
    let color = '#3b82f6'; // Sent (Blue)
    if (type === 'RECEIVED') color = '#10b981'; // Received (Green)
    if (type === 'ERROR') color = '#ef4444'; // Error (Red)

    console.group(`%c${type} [${timestamp}]`, `color: ${color}; font-weight: bold; font-size: 11px;`);
    console.log(`%cHandler Status: %c${handlerStatus}`, "font-weight: bold;", "color: #6b7280;");
    console.log(`%cMuul Origin:    %c${isMuulOrigin ? 'YES ✅ (Bridge Active)' : 'NO ❌ (Normal Browser)'}`, "font-weight: bold;", isMuulOrigin ? "color: #10b981;" : "color: #f43f5e;");
    console.log("%cPayload:", "font-weight: bold;");
    console.log(content);
    console.groupEnd();
  }, []);

  // --- External Bridge Logic ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'SAVED_CREDENTIALS_RESPONSE' || event.data.credentials)) {
        const content = typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2);
        setResultData(content);
        setStatus({ type: 'success', message: 'Data received via postMessage' });
        performDevToolsLog('RECEIVED', event.data, 'Window PostMessage Handler');
      }
    };

    const handleExternalResult = (e: any) => {
      const data = e.detail !== undefined ? e.detail : e;
      setResultData(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
      setStatus({ type: 'success', message: 'Pushed reply received via event listener' });
      performDevToolsLog('RECEIVED', data, 'External Event Handler');
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('external:result', handleExternalResult);

    window.updateBrowserResult = (data: any) => {
      const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      setResultData(content);
      setStatus({ type: 'success', message: 'Result updated via global helper' });
      performDevToolsLog('RECEIVED', data, 'Global Helper (updateBrowserResult)');
    };

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('external:result', handleExternalResult);
      delete window.updateBrowserResult;
    };
  }, [performDevToolsLog]);

  const resetStatus = () => setStatus({ type: 'idle', message: '' });

  const fillJson = (data: any) => {
    setJsonInput(JSON.stringify(data, null, 2));
    resetStatus();
  };

  const handleFetchCredentials = async () => {
    const cmdObj = { type: 'GET_SAVED_CREDENTIALS', requestId: 'list-' + Date.now() };
    const cmdStr = JSON.stringify(cmdObj);
    setJsonInput(cmdStr);
    resetStatus();
    
    const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
    performDevToolsLog('SENT', cmdObj, hStatus);

    try {
      if (window.externalMessage?.send) {
        const res = await window.externalMessage.send(cmdStr);
        setResultData(JSON.stringify(res || [], null, 2));
        setStatus({ type: 'success', message: 'Credentials received' });
        performDevToolsLog('RECEIVED', res, 'Bridge Response');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'Fetch failed', details: e.message });
      performDevToolsLog('ERROR', e.message, 'Handler Exception');
    }
  };

  const handleSendText = async () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'Please enter JSON content.' });
      return;
    }
    resetStatus();
    try {
      let parsed = JSON.parse(jsonInput);
      if (typeof parsed === 'object' && parsed !== null && !parsed.requestId) {
        parsed.requestId = 'req-' + Date.now();
      }
      const cmd = JSON.stringify(parsed);
      setJsonInput(cmd);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', parsed, hStatus);

      if (window.externalMessage?.send) {
        const res = await window.externalMessage.send(cmd);
        setResultData(JSON.stringify(res, null, 2));
        setStatus({ type: 'success', message: 'Command Sent and Response Captured' });
        performDevToolsLog('RECEIVED', res, 'Bridge Response');
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: 'Execution Error', details: error.message });
      performDevToolsLog('ERROR', error.message, 'JSON Parse Error');
    }
  };

  const handleExecuteFormCommand = async () => {
    resetStatus();

    if (commandType === 'GIT_PULL') {
      if (!pullRepo.trim()) {
        setStatus({ type: 'error', message: 'Repository name is required for Pull.' });
        return;
      }
      const payload = {
        type: 'GIT_PULL',
        repo: pullRepo,
        branch: pullBranch,
        path: pathInRepo,
        requestId: 'pull-' + Date.now()
      };
      const payloadStr = JSON.stringify(payload);
      setJsonInput(payloadStr);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', payload, hStatus);

      try {
        if (window.externalMessage?.send) {
          const res = await window.externalMessage.send(payloadStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'Git Pull Executed!' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: 'Pull failed', details: err.message });
        performDevToolsLog('ERROR', err.message, 'Handler Exception');
      }
      return;
    }

    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Please select a file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const payload = {
        type: commandType,
        name: selectedFile.name,
        dataUrl: reader.result,
        target: destination,
        credentialId,
        pathInRepo,
        requestId: 'file-' + Date.now()
      };
      const payloadStr = JSON.stringify(payload);
      setJsonInput(payloadStr);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', { ...payload, dataUrl: '(base64-content)' }, hStatus);

      try {
        if (window.externalMessage?.send) {
          const res = await window.externalMessage.send(payloadStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'File Command Sent!' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: 'File send failed', details: err.message });
        performDevToolsLog('ERROR', err.message, 'Handler Exception');
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans">
      {/* Muul Connection Banner */}
      {isMuulBrowser && (
        <div className="w-full bg-blue-600 text-white text-[10px] font-bold py-1.5 px-4 text-center uppercase tracking-widest animate-in slide-in-from-top duration-500 shadow-md">
          json test page connected to Muul Browser
        </div>
      )}

      <div className="p-6 flex flex-col items-center w-full">
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-start justify-center">
          
          {/* Main Command Card */}
          <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
              <h1 className="text-white font-bold text-lg">JSON Test Page</h1>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${isMuulBrowser ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {isMuulBrowser ? 'Muul Mode' : 'Web Mode'}
              </span>
            </div>

            <div className="flex bg-gray-100 p-1 m-4 rounded-lg">
              <button
                onClick={() => { setActiveTab('text'); resetStatus(); }}
                className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${activeTab === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                JSON Text
              </button>
              <button
                onClick={() => { setActiveTab('file'); resetStatus(); }}
                className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${activeTab === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Command Form
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {activeTab === 'text' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => fillJson(PRINT_JSON)} className="text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Print Template</button>
                    <button onClick={() => fillJson(GIT_TEMPLATE_JSON)} className="text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Git Template</button>
                    <button onClick={() => fillJson(DATABASE_JSON)} className="text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">DB Query</button>
                    <button onClick={handleFetchCredentials} className="text-[10px] py-2 bg-blue-600 border border-blue-700 rounded font-bold text-white hover:bg-blue-700 shadow-sm uppercase tracking-tighter">Fetch DB Credential</button>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{ "type": "COMMAND" }'
                    className={`w-full h-64 p-4 rounded-lg border bg-gray-50 text-xs font-mono focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all resize-none ${status.type === 'error' ? 'border-red-300' : 'border-gray-200'}`}
                    spellCheck={false}
                  />
                  <button onClick={handleSendText} className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-sm shadow-md transition-all uppercase tracking-widest">Send JSON Command</button>
                </div>
              ) : (
                <div className="space-y-4">
                   <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Command Type</label>
                    <select value={commandType} onChange={(e) => setCommandType(e.target.value)} className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none">
                      <option value="GIT_ZIP">GIT_ZIP (Push)</option>
                      <option value="GIT_FILE">GIT_FILE (Push)</option>
                      <option value="GIT_PULL">GIT_PULL (Pull from Remote)</option>
                      <option value="DATABASE">DATABASE</option>
                    </select>
                  </div>

                  {commandType === 'GIT_PULL' ? (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Repository Name</label>
                        <input type="text" value={pullRepo} onChange={(e) => setPullRepo(e.target.value)} placeholder="owner/repo" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Branch</label>
                          <input type="text" value={pullBranch} onChange={(e) => setPullBranch(e.target.value)} placeholder="main" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Sub-path (Opt)</label>
                          <input type="text" value={pathInRepo} onChange={(e) => setPathInRepo(e.target.value)} placeholder="/" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-300">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select Local File</label>
                      <input type="file" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} className="mt-1 w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                    </div>
                  )}
                  
                  <button onClick={handleExecuteFormCommand} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all uppercase tracking-widest">
                    {commandType === 'GIT_PULL' ? 'Execute Git Pull' : 'Send File Content'}
                  </button>
                </div>
              )}

              {status.type !== 'idle' && (
                <div className={`p-3 rounded-lg border text-[11px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                  <div className="flex-1">
                    <p className="font-bold">{status.message}</p>
                    {status.details && <p className="mt-0.5 opacity-70 font-mono text-[9px]">{status.details}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result Card */}
          <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col self-stretch">
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Result View</h2>
              <div className="flex gap-2">
                <button onClick={() => setResultData('')} className="text-[10px] font-bold text-white uppercase tracking-widest bg-green-700 hover:bg-green-800 px-2 py-1 rounded transition-colors">Clear</button>
                {resultData && (
                  <button onClick={() => { setJsonInput(resultData); resetStatus(); }} className="text-[10px] font-bold text-white uppercase tracking-widest bg-green-500 hover:bg-green-400 px-2 py-1 rounded transition-colors">Copy to Input</button>
                )}
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Incoming Browser Response</label>
                {resultData && <span className="text-[10px] text-green-600 font-bold animate-pulse">Updated</span>}
              </div>
              <div className="relative flex-1 group">
                <div className="absolute inset-0 bg-gray-900 rounded-lg shadow-inner overflow-hidden border border-gray-800">
                  <textarea readOnly value={resultData} placeholder="Waiting for bridge activity..." className="w-full h-full p-4 bg-transparent text-green-400 text-xs font-mono leading-relaxed focus:outline-none resize-none placeholder-gray-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 mb-8 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMuulBrowser ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
            {isMuulBrowser ? 'Muul Browser Bridge Active' : 'Native Bridge Missing'}
          </div>
          <p className="opacity-60 text-center">Open Browser DevTools (F12 / Cmd+Opt+I) to view detailed operation logs & origin checks</p>
        </div>
      </div>
    </div>
  );
}
