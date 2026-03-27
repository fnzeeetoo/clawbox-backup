import { useState, useEffect } from 'react';

export default function SourceForm({ onSave, onCancel, initialData }) {
  const [form, setForm] = useState({
    name: '',
    path: '',
    type: 'directory',
    exclude: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        path: initialData.path || '',
        type: initialData.type || 'directory',
        exclude: initialData.exclude ? initialData.exclude.join('\n') : '',
      });
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...form,
        exclude: form.exclude.split('\n').map(s => s.trim()).filter(Boolean),
      };

      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save source');
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
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 focus:border-clawbox-500"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., OpenClaw Workspace"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
        <input
          type="text"
          required
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 focus:border-clawbox-500 font-mono"
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          placeholder="/path/to/directory"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="directory">Directory</option>
          <option value="disk">Disk</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Exclude Patterns (one per line)
        </label>
        <textarea
          rows={4}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 font-mono text-sm"
          value={form.exclude}
          onChange={(e) => setForm({ ...form, exclude: e.target.value })}
          placeholder="node_modules&#10;.cache&#10;.git"
        />
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
          {loading ? 'Saving...' : 'Save Source'}
        </button>
      </div>
    </form>
  );
}
