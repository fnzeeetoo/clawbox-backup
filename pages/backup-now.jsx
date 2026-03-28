import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function BackupNow() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runBackup = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (e: any) {
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
              Trigger an immediate backup of all configured sources to their destinations.
            </p>
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-800 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            {result && (
              <div className="mb-4 p-4 bg-green-50 text-green-800 rounded">
                Backup started (or completed) successfully. ID: {result.data?.id || 'N/A'}
              </div>
            )}
            <button
              onClick={runBackup}
              disabled={loading}
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
