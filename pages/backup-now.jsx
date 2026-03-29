import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function BackupNow() {
  const [sources, setSources] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [backupType, setBackupType] = useState('incremental');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [sourcesRes, destsRes] = await Promise.all([
        fetch('/api/sources'),
        fetch('/api/destinations'),
      ]);
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.data || []);
      }
      if (destsRes.ok) {
        const data = await destsRes.json();
        setDestinations(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch options', e);
    }
  };

  const runBackup = async () => {
    if (!selectedSource || !selectedDestination) {
      setError('Please select both source and destination');
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let responses;
      if (selectedSource === 'all') {
        // Run backup for all sources
        responses = await Promise.all(
          sources.map(src =>
            fetch('/api/backups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceId: src.id,
                destinationId: selectedDestination,
                backupType,
              }),
            }).then(res => res.json())
          )
        );
        const failures = responses.filter(r => !r.success);
        if (failures.length > 0) {
          setError(`${failures.length} of ${responses.length} backups failed`);
        } else {
          setResult({ data: responses.map(r => r.data) });
        }
      } else {
        const res = await fetch('/api/backups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: selectedSource,
            destinationId: selectedDestination,
            backupType,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setResult(data);
        } else {
          setError(data.error || 'Unknown error');
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Backup Now | Clawbox Backup</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Clawbox Backup</h1>
            <nav className="flex space-x-4">
              <Link href="/" className="text-gray-600 hover:text-clawbox-600">Dashboard</Link>
              <Link href="/configure" className="text-gray-600 hover:text-clawbox-600">Configure</Link>
              <Link href="/backup-now" className="text-clawbox-600 font-medium">Backup Now</Link>
              <Link href="/restore" className="text-gray-600 hover:text-clawbox-600">Restore</Link>
              <Link href="/monitoring" className="text-gray-600 hover:text-clawbox-600">Logs</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Run Backup Now</h2>
            <p className="text-gray-600 mb-6">
              Select source and destination, then start an immediate backup.
            </p>
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-800 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            {result && (
              <div className="mb-4 p-4 bg-green-50 text-green-800 rounded">
                <p><strong>Backup completed successfully!</strong></p>
                {Array.isArray(result.data) ? (
                  <ul className="text-sm mt-1 list-disc list-inside">
                    {result.data.map((b, i) => (
                      <li key={i}>{b.id}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm mt-1">ID: {result.data?.id || 'N/A'}</p>
                )}
                <p className="text-sm text-green-700 mt-2">
                  <Link href="/" className="underline">Return to Dashboard</Link> to see updated stats.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-clawbox-500 focus:border-clawbox-500"
                >
                  <option value="">Select a source</option>
                  <option value="all">All Sources (run all)</option>
                  {sources.map((src) => (
                    <option key={src.id} value={src.id}>{src.name} ({src.path})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-clawbox-500 focus:border-clawbox-500"
                >
                  <option value="">Select a destination</option>
                  {destinations.map((dst) => (
                    <option key={dst.id} value={dst.id}>{dst.name} ({dst.mountPoint})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Backup Type</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="backupType"
                    value="incremental"
                    checked={backupType === 'incremental'}
                    onChange={() => setBackupType('incremental')}
                    className="form-radio h-4 w-4 text-clawbox-600"
                  />
                  <span className="ml-2">Incremental</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="backupType"
                    value="full"
                    checked={backupType === 'full'}
                    onChange={() => setBackupType('full')}
                    className="form-radio h-4 w-4 text-clawbox-600"
                  />
                  <span className="ml-2">Full</span>
                </label>
              </div>
            </div>
            <button
              onClick={runBackup}
              disabled={loading || !selectedSource || !selectedDestination}
              className="px-4 py-2 bg-clawbox-600 text-white rounded hover:bg-clawbox-700 disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Backup'}
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
