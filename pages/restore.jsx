import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

function getParentDir(path) {
  if (!path || path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  parts.pop();
  return '/' + parts.join('/');
}

export default function Restore() {
  const router = useRouter();
  const { backup: backupId } = router.query;

  const [backups, setBackups] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [targetPath, setTargetPath] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    try {
      const [backupsRes, sourcesRes] = await Promise.all([
        fetch('/api/backups'),
        fetch('/api/sources'),
      ]);
      if (backupsRes.ok) {
        const data = await backupsRes.json();
        setBackups(data.data || []);
      }
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const getSourceName = (sourceId) => {
    const src = sources.find(s => s.id === sourceId);
    return src?.name || sourceId;
  };

  const getDefaultRestorePath = (backup) => {
    if (backup.sourcePath) {
      return getParentDir(backup.sourcePath);
    }
    return '/restore';
  };

  const handleRestore = async () => {
    if (!selectedBackup || !targetPath) return;
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath, overwrite }),
      });
      if (res.ok) {
        setLogs(prev => [...prev, '✅ Restore initiated successfully']);
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

  // Group backups by source
  const grouped = backups.reduce((acc, backup) => {
    const srcId = backup.sourceId;
    if (!acc[srcId]) acc[srcId] = [];
    acc[srcId].push(backup);
    return acc;
  }, {});

  // Sort groups by most recent backup date
  const sortedGroupEntries = Object.entries(grouped).sort(([, a], [, b]) => {
    const newestA = Math.max(...a.map(bk => new Date(bk.startedAt).getTime()));
    const newestB = Math.max(...b.map(bk => new Date(bk.startedAt).getTime()));
    return newestB - newestA;
  });

  const formatSize = (bytes) => {
    if (bytes >= 1024*1024*1024) return `${(bytes/(1024*1024*1024)).toFixed(2)} GB`;
    if (bytes >= 1024*1024) return `${(bytes/(1024*1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes/1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <>
      <Head><title>Restore Backup</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Clawbox Backup</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-gray-600 hover:text-clawbox-600">Dashboard</Link>
              <Link href="/configure" className="text-gray-600 hover:text-clawbox-600">Configure</Link>
              <Link href="/backup-now" className="text-gray-600 hover:text-clawbox-600">Backup Now</Link>
              <Link href="/restore" className="text-clawbox-600 font-medium">Restore</Link>
              <Link href="/monitoring" className="text-gray-600 hover:text-clawbox-600">Logs</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Restore Options - sticky sidebar on desktop, top on mobile */}
            <div className="lg:col-span-1 order-1 lg:order-1">
              {selectedBackup ? (
                <div className="bg-white shadow rounded-lg p-6 sticky top-8">
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
                        Default: parent directory of original source ({getDefaultRestorePath(selectedBackup)})
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        The backup will restore the source directory (e.g., <code>testfiledir</code>) into this target location.
                      </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important Notes</h4>
                      <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                        <li>Existing files at the target path may be overwritten</li>
                        <li>Ensure sufficient disk space before restoring</li>
                        <li>For disk images, restore requires bootable media</li>
                        <li>It's recommended to test restore on non-critical data first</li>
                      </ul>
                    </div>

                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={overwrite}
                          onChange={(e) => setOverwrite(e.target.checked)}
                          className="form-checkbox h-4 w-4 text-clawbox-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Overwrite target directory (destructive restore)
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        If checked, the existing target directory will be deleted before restoring.
                      </p>
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
              ) : (
                <div className="bg-white shadow rounded-lg p-6">
                  <p className="text-gray-500 italic">
                    Select a backup from the list to view restore options.
                  </p>
                </div>
              )}
            </div>

            {/* Backup Selection - order 2 on mobile, 2 on desktop (main content) */}
            <div className="lg:col-span-2 order-2 lg:order-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Backup to Restore</h2>

                {backups.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No backups available</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sortedGroupEntries.map(([srcId, srcBackups]) => {
                      const srcName = getSourceName(srcId);
                      const sortedBackups = [...srcBackups].sort((a, b) =>
                        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
                      );
                      return (
                        <details key={srcId} open className="border rounded-lg overflow-hidden">
                          <summary className="bg-gray-100 px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-200">
                            {srcName} ({srcBackups.length} backup{srcBackups.length !== 1 ? 's' : ''})
                          </summary>
                          <div className="p-4 space-y-3">
                            {sortedBackups.map((backup) => (
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
                                      <h3 className="font-medium text-gray-900 text-sm">ID: {backup.id}</h3>
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
                                      {formatDate(backup.startedAt)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Size: {formatSize(backup.size)}
                                    </p>
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
                        </details>
                      );
                    })}
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
