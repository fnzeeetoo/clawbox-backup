import { useState, useEffect } from 'react';

export default function DestinationForm({ onSave, onCancel, initialData }) {
  const [form, setForm] = useState({
    name: '',
    type: 'local',
    mountPoint: '',
    path: 'clawbox-backups',
    retentionPolicy: 'keep_last',
    retentionDays: 30,
    accessToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usbMountPoints, setUsbMountPoints] = useState([]); // {device, mountPoint, label}[]
  const [loadingUsb, setLoadingUsb] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        type: initialData.type || 'local',
        mountPoint: initialData.mountPoint || '',
        path: initialData.path || 'clawbox-backups',
        retentionPolicy: initialData.retention?.policy || 'keep_last',
        retentionDays: initialData.retention?.days || 30,
        accessToken: initialData.accessToken || '',
      });
    }
  }, [initialData]);

  // Fetch USB mount points when type is USB
  useEffect(() => {
    if (form.type === 'usb') {
      setLoadingUsb(true);
      fetch('/api/usb')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Only show partitions (already filtered by API), and dedupe by mountPoint
            const unique = [];
            const seen = new Set();
            for (const dev of data.data) {
              if (!seen.has(dev.mountPoint)) {
                seen.add(dev.mountPoint);
                unique.push(dev);
              }
            }
            setUsbMountPoints(unique);
            // Auto-select first if not already set
            if (!form.mountPoint && unique.length > 0) {
              setForm(f => ({ ...f, mountPoint: unique[0].mountPoint }));
            }
          } else {
            setUsbMountPoints([]);
          }
        })
        .catch(() => setUsbMountPoints([]))
        .finally(() => setLoadingUsb(false));
    } else {
      setUsbMountPoints([]);
    }
  }, [form.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        type: form.type,
        retention: {
          policy: form.retentionPolicy,
          days: form.retentionDays,
        },
      };

      if (form.type === 'local') {
        payload.mountPoint = '/var/backups';
      } else {
        if (!form.mountPoint) throw new Error('Mount point is required');
        payload.mountPoint = form.mountPoint;
      }

      if (form.path) payload.path = form.path;

      if (form.type === 'dropbox' && form.accessToken) {
        payload.accessToken = form.accessToken;
      }

      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save destination');
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
          placeholder="e.g., Local SSD Backup Store"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value, mountPoint: '' })}
        >
          <option value="local">Local (built-in)</option>
          <option value="usb">USB Drive</option>
          <option value="nas">NAS (NFS/SMB)</option>
          <option value="dropbox">Dropbox</option>
        </select>
      </div>

      {form.type === 'local' ? (
        <p className="text-sm text-gray-500">Local destination uses /var/backups</p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mount Point</label>
          {form.type === 'usb' && usbMountPoints.length > 0 ? (
            <select
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
              value={form.mountPoint}
              onChange={(e) => setForm({ ...form, mountPoint: e.target.value })}
            >
              {usbMountPoints.map((dev) => (
                <option key={dev.device} value={dev.mountPoint}>
                  {dev.label || dev.device} ({dev.mountPoint})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 font-mono"
              value={form.mountPoint}
              onChange={(e) => setForm({ ...form, mountPoint: e.target.value })}
              placeholder={form.type === 'usb' ? '/mnt/usb' : '/mnt/nas'}
            />
          )}
          {form.type === 'usb' && loadingUsb && (
            <p className="text-sm text-gray-500 mt-1">Detecting USB drives...</p>
          )}
        </div>
      )}

      {(form.type === 'usb' || form.type === 'nas') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Backup Path (relative to mount)</label>
          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
            placeholder="clawbox-backups"
          />
        </div>
      )}

      {form.type === 'dropbox' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dropbox Access Token</label>
          <textarea
            rows={3}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500 font-mono text-sm"
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            placeholder="sl.xxx..."
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Retention Policy</label>
          <select
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
            value={form.retentionPolicy}
            onChange={(e) => setForm({ ...form, retentionPolicy: e.target.value })}
          >
            <option value="keep_last">Keep Last N Days</option>
            <option value="keep_count">Keep Count</option>
            <option value="keep_indefinitely">Keep Indefinitely</option>
          </select>
        </div>
        {form.retentionPolicy !== 'keep_indefinitely' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Days / Count</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-clawbox-500"
              value={form.retentionDays}
              onChange={(e) => setForm({ ...form, retentionDays: parseInt(e.target.value) || 1 })}
            />
          </div>
        )}
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
          {loading ? 'Saving...' : 'Save Destination'}
        </button>
      </div>
    </form>
  );
}
