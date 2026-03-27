import chokidar from 'chokidar';
import { existsSync } from 'fs';

export class Monitor {
  constructor() {
    this.watchers = new Map();
    this.sources = new Map();
    this.changeCallbacks = [];
    this.isWatching = false;
  }

  async startMonitoring(sources, callback) {
    this.changeCallbacks.push(callback);

    for (const source of sources) {
      if (!existsSync(source.path)) {
        console.warn(`Source path does not exist, skipping: ${source.path}`);
        continue;
      }

      this.sources.set(source.id, source);
      await this.watchSource(source);
    }

    this.isWatching = true;
    console.log(`Monitoring ${this.watchers.size} source(s)`);
  }

  async stopMonitoring() {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    this.sources.clear();
    this.changeCallbacks = [];
    this.isWatching = false;
    console.log('Monitoring stopped');
  }

  isActive() {
    return this.isWatching;
  }

  async addSource(source) {
    if (!existsSync(source.path)) {
      throw new Error(`Source path does not exist: ${source.path}`);
    }

    this.sources.set(source.id, source);
    await this.watchSource(source);
  }

  removeSource(sourceId) {
    const watcher = this.watchers.get(sourceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sourceId);
    }
    this.sources.delete(sourceId);
  }

  async watchSource(source) {
    const excludePatterns = this.convertExcludeToGlob(source.exclude || []);

    const watcher = chokidar.watch(source.path, {
      ignored: excludePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    watcher
      .on('add', (filePath) => {
        this.notifyChange('add', filePath);
      })
      .on('change', (filePath) => {
        this.notifyChange('change', filePath);
      })
      .on('unlink', (filePath) => {
        this.notifyChange('unlink', filePath);
      })
      .on('error', (error) => {
        console.error(`Watcher error for ${source.path}:`, error);
      });

    this.watchers.set(source.id, watcher);
    console.log(`Started watching: ${source.path} (exclude: ${excludePatterns.join(', ') || 'none'})`);
  }

  notifyChange(event, filePath) {
    for (const cb of this.changeCallbacks) {
      try {
        cb(event, filePath);
      } catch (error) {
        console.error('Change callback error:', error);
      }
    }
  }

  convertExcludeToGlob(exclude) {
    return exclude.map(pattern => {
      if (pattern.includes('**')) {
        return pattern.replace(/\*\*/g, '*');
      }
      return pattern;
    });
  }

  async scanForChanges(source, since) {
    const changes = [];
    return changes;
  }
}