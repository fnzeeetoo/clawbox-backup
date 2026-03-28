import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Monitoring() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);

  useEffect(() => {
    // Fetch initial logs
    fetchLogs();

    // Poll for new logs every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchLogs = async () => {
    try {
      // In a real implementation, this would hit the local API
      // For now, we'll just simulate or read from syslog
      const res = await fetch('/api/stats');
      if (res.ok) {
        // We'd normally fetch actual log tail from the engine
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const addLog = (entry) => {
    setLogs(prev => [...prev.slice(-499), entry]); // Keep last 500 lines
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'debug':
        return 'text-gray-400';
      default:
        return 'text-green-400';
    }
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter);

  return (
    <>
      <Head>
        <title>Backup Logs</title>
      </Head>

      <div className="min-h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Monitoring & Logs</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-300 text-sm">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
              <nav className="flex space-x-4 ml-4">
                <Link href="/" className="text-gray-300 hover:text-white">Dashboard</Link>
                <Link href="/configure" className="text-gray-300 hover:text-white">Configure</Link>
                <Link href="/backup-now" className="text-gray-300 hover:text-white">Backup Now</Link>
                <Link href="/restore" className="text-gray-300 hover:text-white">Restore</Link>
                <Link href="/monitoring" className="text-white font-medium">Logs</Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Log Viewport */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm h-[calc(100vh-200px)] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 italic">
                Waiting for log entries... (Check that backup engine is running)
              </div>
            ) : (
              filteredLogs.map((log, idx) => (
                <div key={idx} className="mb-1 flex">
                  <span className="text-gray-500 mr-4 shrink-0">{log.timestamp}</span>
                  <span className={`${getLevelColor(log.level)} mr-4 shrink-0 w-16`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-gray-200 break-all">{log.message}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Controls */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Logs:</span>
                  <span className="text-white">{logs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Filtered:</span>
                  <span className="text-white">{filteredLogs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Engine Status:</span>
                  <span className={`font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
                    {connected ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setLogs([])}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Clear Logs
                </button>
                <button
                  onClick={fetchLogs}
                  className="w-full px-3 py-2 bg-clawbox-600 text-white rounded hover:bg-clawbox-700 text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-3">Log Level</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Current:</span>
                <span className="text-yellow-400 font-medium">Info</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Change log level in config.json (debug, info, warn, error)
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}