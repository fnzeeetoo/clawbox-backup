import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Restore() {
  const router = useRouter();
  const { backup: backupId } = router.query;

  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [targetPath, setTargetPath] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  useEffect(() => {
    if (backupId && backups.length > 0) {
      const backup = backups.find(b => b.id === backupId);
      if (backup) {
        setSelectedBackup(backup);
        setTargetPath(getDefaultRestorePath(backup));
      }
    }
  }, [backupId, backups]);

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const getDefaultRestorePath = (backup) => {
    // Derive original path from metadata or construct from ID
    if (backup.metadata?.sourcePath) {
      return backup.metadata.sourcePath;
    }
    // Fallback: extract from backup ID (e.g., "user-data-full-2026..." -> /home/clawbox)
    const parts = backup.id.split('-');
    if (parts[0] === 'user') return '/home/clawbox';
    if (parts[0] === 'etc') return '/etc';
    return '/restore';
  };

  const handleRestore = async () => {
    if (!selectedBackup || !targetPath) return;

    setRestoring(true);
    setError(null);
    setLogs([]);

    try {
      const res = await fetch(`/api/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath }),
      });

      if (res.ok) {
        setLogs(prev => [...prev, '✅ Restore initiated successfully']);
        // In a real implementation, we'd poll for status or use WebSocket
      } else {
        const err = await res.json();
        setError(err.error || 'Restore failed');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Head>
        <title>Restore Backup</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Restore Backup</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-gray-600 hover:text-clawbox-600">Dashboard</Link>
              <Link href="/configure" className="text-gray-600 hover:text-clawbox-600">Configure</Link>
              <Link href="/restore" className="text-clawbox-600 font-medium">Restore</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Backup Selection */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Backup to Restore</h2>

                {backups.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No backups available</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        onClick={() => setSelectedBackup(backup)}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedBackup?.id === backup.id
                            ? 'border-clawbox-500 bg-clawbox-50'
                            : 'border-gray-200 hover:border-clawbox-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-gray-900">{backup.sourceId}</h3>
                              <span className={`px-2 py-1 text-xs rounded ${
                                backup.type === 'full' ? 'bg-purple-100 text-purple-800' :
                                backup.type === 'disk-image' ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {backup.type}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded ${
                                backup.status === 'completed' || backup.status === 'verified'
                                  ? 'bg-green-100 text-green-700'
                                  : backup.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {backup.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              Created: {new Date(backup.timestamp).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              Size: {(backup.size / 1024 / 1024 / 1024).toFixed(2)} GB
                            </p>
                            {backup.metadata?.fileCount && (
                              <p className="text-sm text-gray-500">
                                Files: {backup.metadata.fileCount.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBackup(backup);
                              setTargetPath(getDefaultRestorePath(backup));
                            }}
                            className={`px-3 py-1 text-sm rounded ${
                              selectedBackup?.id === backup.id
                                ? 'bg-clawbox-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {selectedBackup?.id === backup.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Restore Options */}
              {selectedBackup && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Restore Options</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Restore Target Path
                      </label>
                      <input
                        type="text"
                        value={targetPath}
                        onChange={(e) => setTargetPath(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clawbox-500 focus:border-clawbox-500"
                        placeholder="/restore or /home/clawbox"
                      />
                      <p className="text-sm text-gray-400 mt-1">
                        Default: {getDefaultRestorePath(selectedBackup)}
                      </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important Notes</h4>
                      <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                        <li>Existing files at the target path may be overwritten</li>
                        <li>Ensure sufficient disk space before restoring</li>
                        <li>For disk images, restore requires bootable media</li>
                        <li>It&apos;s recommended to test restore on non-critical data first</li>
                      </ul>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleRestore}
                        disabled={restoring || !targetPath}
                        className="px-6 py-2 bg-clawbox-600 text-white rounded-lg hover:bg-clawbox-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoring ? 'Restoring...' : 'Start Restore'}
                      </button>
                      <button
                        onClick={() => setSelectedBackup(null)}
                        className="px-6 py-2 text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Restore Logs */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg p-6 sticky top-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Restore Logs</h2>
                <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-gray-400">
                      No restore activity yet. Select a backup and start restore to see logs.
                    </div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className="mb-1">
                        {log}
                      </div>
                    ))
                  )}
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}