import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [backupsRes, statsRes] = await Promise.all([
        fetch('/api/backups'),
        fetch('/api/stats'),
      ]);

      if (backupsRes.ok) {
        const backupsData = await backupsRes.json();
        setBackups(backupsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Head>
        <title>Clawbox Backup Dashboard</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Clawbox Backup</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-clawbox-600 font-medium">Dashboard</Link>
              <Link href="/configure" className="text-gray-600 hover:text-clawbox-600">Configure</Link>
              <Link href="/restore" className="text-gray-600 hover:text-clawbox-600">Restore</Link>
              <Link href="/monitoring" className="text-gray-600 hover:text-clawbox-600">Logs</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clawbox-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500">System Uptime</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {Math.floor(stats.system.uptime / 3600)}h {Math.floor((stats.system.uptime % 3600) / 60)}m
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500">Total Backups</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {backups.length}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500">Backup Destinations</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.destinations.length}
                    </p>
                  </div>
                </div>
              )}

              {/* Destinations */}
              {stats && (
                <div className="bg-white shadow rounded-lg mb-8">
                  <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-medium text-gray-900">Backup Destinations</h2>
                  </div>
                  <div className="p-6">
                    {stats.destinations.length === 0 ? (
                      <p className="text-gray-500">No destinations configured</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {stats.destinations.map((dest) => (
                          <div key={dest.destinationId} className="border rounded-lg p-4">
                            <h4 className="font-medium text-gray-900">{dest.destinationId}</h4>
                            <div className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Backups:</span>
                                <span className="font-medium">{dest.totalBackups}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total Size:</span>
                                <span className="font-medium">{formatBytes(dest.totalSize)}</span>
                              </div>
                              {dest.newestBackup && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Latest:</span>
                                  <span className="font-medium">{formatDate(dest.newestBackup.toISOString())}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Backups */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Recent Backups</h2>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 text-sm bg-clawbox-100 text-clawbox-700 rounded hover:bg-clawbox-200"
                  >
                    Refresh
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {backups.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <p>No backups have been run yet.</p>
                      <p className="mt-2">
                        <Link href="/configure" className="text-clawbox-600 hover:underline">
                          Configure your first backup
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {backups.slice(0, 20).map((backup) => (
                          <tr key={backup.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              {backup.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                backup.type === 'full' ? 'bg-purple-100 text-purple-800' :
                                backup.type === 'disk-image' ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {backup.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(backup.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatBytes(backup.size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(backup.status)}`}>
                                {backup.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {backup.status === 'completed' && (
                                <Link
                                  href={`/restore?backup=${backup.id}`}
                                  className="text-clawbox-600 hover:text-clawbox-900 font-medium"
                                >
                                  Restore
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}