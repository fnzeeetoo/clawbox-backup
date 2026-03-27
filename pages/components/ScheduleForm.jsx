import { useState, useEffect } from 'react';

export default function ScheduleForm({ onSave, onCancel, initialData, availableSources, availableDestinations }) {
  const [form, setForm] = useState({
    name: '',
    cron: '',
    sourceId: '',
    destinationId: '',
    backupType: 'incremental',
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        cron: initialData.cron || '',
        sourceId: initialData.sourceId || '',
        destinationId: initialData.destinationId || '',
        backupType: initialData.backupType || 'incremental',
        enabled: initialData.enabled !== undefined ? initialData.enabled : true,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save schedule');
      }

      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          required
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., Nightly Backup"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
        <input
          type="text"
          required
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 font-mono"
          value={form.cron}
          onChange={(e) => setForm({ ...form, cron: e.target.value })}
          placeholder="0 2 * * *"
        />
        <p className="text-xs text-gray-500 mt-1">Minute Hour Day Month Weekday</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select
            required
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
            value={form.sourceId}
            onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
          >
            <option value="">Select source...</option>
            {availableSources.map((src) => (
              <option key={src.id} value={src.id}>{src.name} ({src.path})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
          <select
            required
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
            value={form.destinationId}
            onChange={(e) => setForm({ ...form, destinationId: e.target.value })}
          >
            <option value="">Select destination...</option>
            {availableDestinations.map((dst) => (
              <option key={dst.id} value={dst.id}>{dst.name} ({dst.type})</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Backup Type</label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="incremental"
              checked={form.backupType === 'incremental'}
              onChange={(e) => setForm({ ...form, backupType: e.target.value })}
              className="mr-2"
            />
            Incremental
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="full"
              checked={form.backupType === 'full'}
              onChange={(e) => setForm({ ...form, backupType: e.target.value })}
              className="mr-2"
            />
            Full
          </label>
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="enabled"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
          Enabled (uncheck to disable temporarily)
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-clawbox-600 text-white rounded-lg hover:bg-clawbox-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </form>
  );
}
