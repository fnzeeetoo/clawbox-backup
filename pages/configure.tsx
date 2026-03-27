import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { BackupSource, BackupDestination, BackupSchedule } from '../types';

export default function Configure() {
  const [activeTab, setActiveTab] = useState<'sources' | 'destinations' | 'schedules'>('sources');
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sourcesRes, destsRes, schedsRes] = await Promise.all([
        fetch('/api/sources'),
        fetch('/api/destinations'),
        fetch('/api/schedules'),
      ]);

      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.data || []);
      }
      if (destsRes.ok) {
        const data = await destsRes.json();
        setDestinations(data.data || []);
      }
      if (schedsRes.ok) {
        const data = await schedsRes.json();
        setSchedules(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Configure Backups</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Configure</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-gray-600 hover:text-clawbox-600">Dashboard</Link>
              <Link href="/configure" className="text-clawbox-600 font-medium">Configure</Link>
              <Link href="/restore" className="text-gray-600 hover:text-clawbox-600">Restore</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clawbox-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading configuration...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Navigation */}
              <div className="lg:col-span-1">
                <div className="bg-white shadow rounded-lg p-4 sticky top-8">
                  <nav className="space-y-2">
                    {[
                      { id: 'sources', label: 'Sources', icon: '📁', count: sources.length },
                      { id: 'destinations', label: 'Destinations', icon: '💾', count: destinations.length },
                      { id: 'schedules', label: 'Schedules', icon: '⏰', count: schedules.length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left ${
                          activeTab === tab.id
                            ? 'bg-clawbox-100 text-clawbox-900 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>
                          <span className="mr-2">{tab.icon}</span>
                          {tab.label}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activeTab === tab.id ? 'bg-clawbox-200' : 'bg-gray-200'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </nav>

                  <div className="mt-6 pt-6 border-t">
                    <button
                      onClick={async () => {
                        // Auto-detect USB
                        const res = await fetch('/api/usb');
                        if (res.ok) {
                          const data = await res.json();
                          alert(`Found ${data.data?.length || 0} USB device(s)`);
                        }
                      }}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Detect USB
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="lg:col-span-3 space-y-6">
                {/* Sources Tab */}
                {activeTab === 'sources' && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Backup Sources</h2>
                      <button
                        onClick={() => {/* Open source modal */}}
                        className="px-4 py-2 bg-clawbox-600 text-white rounded-lg hover:bg-clawbox-700"
                      >
                        + Add Source
                      </button>
                    </div>
                    {sources.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500 mb-4">No backup sources configured</p>
                        <p className="text-sm text-gray-400">Add directories or disks to include in backups</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sources.map((source) => (
                          <div key={source.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium text-gray-900">{source.name}</h3>
                                <p className="text-sm text-gray-500 mt-1 font-mono">{source.path}</p>
                                <p className="text-sm text-gray-400 mt-1">Type: {source.type}</p>
                                {source.exclude && source.exclude.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-500">Excludes:</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {source.exclude.map((pattern, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                                          {pattern}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {/* Edit source */}}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm('Delete this source?')) {
                                      await fetch(`/api/sources/${source.id}`, { method: 'DELETE' });
                                      fetchData();
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Destinations Tab */}
                {activeTab === 'destinations' && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Backup Destinations</h2>
                      <button
                        onClick={() => {/* Open destination modal */}}
                        className="px-4 py-2 bg-clawbox-600 text-white rounded-lg hover:bg-clawbox-700"
                      >
                        + Add Destination
                      </button>
                    </div>
                    {destinations.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500 mb-4">No backup destinations configured</p>
                        <p className="text-sm text-gray-400 mb-4">
                          Add USB drives, NAS shares, or cloud storage
                        </p>
                        <div className="flex justify-center space-x-4">
                          <button
                            onClick={async () => {
                              // Auto-detect USB
                              const res = await fetch('/api/usb');
                              // Show detected devices in UI
                            }}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            🔍 Detect USB
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {destinations.map((dest) => (
                          <div key={dest.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium text-gray-900">{dest.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                  Type: {dest.type} {dest.mountPoint && `• Mount: ${dest.mountPoint}`}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                  Retention: {dest.retention.policy} {dest.retention.days && `(${dest.retention.days} days)`}
                                </p>
                                <span className={`inline-block px-2 py-1 text-xs rounded mt-2 ${
                                  dest.status === 'connected' ? 'bg-green-100 text-green-700' :
                                  dest.status === 'error' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {dest.status || 'unknown'}
                                </span>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {/* Edit destination */}}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm('Delete this destination?')) {
                                      await fetch(`/api/destinations/${dest.id}`, { method: 'DELETE' });
                                      fetchData();
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Schedules Tab */}
                {activeTab === 'schedules' && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Backup Schedules</h2>
                      <button
                        onClick={() => {/* Open schedule modal */}}
                        className="px-4 py-2 bg-clawbox-600 text-white rounded-lg hover:bg-clawbox-700"
                      >
                        + Add Schedule
                      </button>
                    </div>
                    {schedules.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">No schedules configured</p>
                        <p className="text-sm text-gray-400">Set up automated backups with cron expressions</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {schedules.map((schedule) => (
                          <div key={schedule.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center">
                                  <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                                  <span className={`ml-3 px-2 py-1 text-xs rounded ${
                                    schedule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">{schedule.cron}</span>
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                  {schedule.backupType} backup of <span className="font-medium">{schedule.sourceId}</span> →{' '}
                                  <span className="font-medium">{schedule.destinationId}</span>
                                </p>
                                {schedule.lastRun && (
                                  <p className="text-xs text-gray-400 mt-2">
                                    Last run: {new Date(schedule.lastRun).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {/* Edit schedule */}}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' });
                                    fetchData();
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}