import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [destinationsConfig, setDestinationsConfig] = useState([]);
  const [sourcesConfig, setSourcesConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [backupsRes, statsRes, destsRes, sourcesRes] = await Promise.all([
        fetch('/api/backups'),
        fetch('/api/stats'),
        fetch('/api/destinations'),
        fetch('/api/sources'),
      ]);

      if (backupsRes.ok) {
        const backupsData = await backupsRes.json();
        setBackups(backupsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (destsRes.ok) {
        const destsData = await destsRes.json();
        setDestinationsConfig(destsData.data || []);
      }

      if (sourcesRes.ok) {
        const sourcesData = await sourcesRes.json();
        setSourcesConfig(sourcesData.data || []);
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

  // Build maps
  const destNameMap = {};
  destinationsConfig.forEach(d => { destNameMap[d.id] = d.name; });

  const sourceNameMap = {};
  sourcesConfig.forEach(s => { sourceNameMap[s.id] = s.name; });

  // Sort backups
  const sortedBackups = [...backups].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (sortField === 'startedAt') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  return (
    <>
      <Head>
        <title>Clawbox Backup Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Clawbox Backup</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-clawbox-600 font-medium">Dashboard</Link>
              <Link href="/configure" className="text-gray-600 hover:text-clawbox-600">Configure</Link>
              <Link href="/backup-now" className="text-gray-600 hover:text-clawbox-600">Backup Now</Link>
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
              {stats && stats.system && (
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
                      {stats.destinations?.length || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Destinations */}
              {stats && stats.destinations && (
                <div className="bg-white shadow rounded-lg mb-8">
                  <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-medium text-gray-900">Backup Destinations</h2>
                  </div>
                  <div className="p-6">
                    {stats.destinations.length === 0 ? (
                      <p className="text-gray-500">No destinations configured</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {stats.destinations.map((dest) => {
                          const displayName = destNameMap[dest.destinationId] || dest.destinationId;
                          return (
                            <div key={dest.destinationId} className="border rounded-lg p-4">
                              <h4 className="font-medium text-gray-900">{displayName}</h4>
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
                                    <span className="font-medium">{formatDate(dest.newestBackup)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                    onClick={fetchData}
                    className="px-3 py-1 text-sm bg-clawbox-100 text-clawbox-700 rounded hover:bg-clawbox-200"
                  >
                    Refresh
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-48" onClick={() => handleSort('sourceId')}>
                          Source {getSortIcon('sourceId')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-64" onClick={() => handleSort('id')}>
                          ID {getSortIcon('id')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-24" onClick={() => handleSort('type')}>
                          Type {getSortIcon('type')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-40" onClick={() => handleSort('startedAt')}>
                          Timestamp {getSortIcon('startedAt')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-24" onClick={() => handleSort('size')}>
                          Size {getSortIcon('size')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer w-24" onClick={() => handleSort('status')}>
                          Status {getSortIcon('status')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedBackups.slice(0, 50).map((backup) => (
                        <tr key={backup.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 truncate max-w-xs" title={sourceNameMap[backup.sourceId] || backup.sourceId}>
                            {sourceNameMap[backup.sourceId] || backup.sourceId}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 truncate max-w-xs" title={backup.id}>
                            {backup.id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              backup.type === 'full' ? 'bg-purple-100 text-purple-800' :
                              backup.type === 'disk-image' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {backup.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(backup.startedAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatBytes(backup.size)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(backup.status)}`}>
                              {backup.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
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
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
