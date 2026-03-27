import cron from 'node-cron';

export class Scheduler {
  constructor(engine) {
    this.engine = engine;
    this.schedules = [];
    this.jobs = new Map();
  }

  loadSchedules(schedules) {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();

    this.schedules = schedules.filter(s => s.enabled);

    for (const schedule of this.schedules) {
      this.scheduleJob(schedule);
    }
  }

  scheduleJob(schedule) {
    if (!cron.validate(schedule.cron)) {
      console.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cron}`);
      return;
    }

    const task = cron.schedule(schedule.cron, async () => {
      console.log(`Executing scheduled backup: ${schedule.name} (${schedule.id})`);
      await this.executeSchedule(schedule);
    }, {
      scheduled: true,
      timezone: 'Europe/Kiev',
    });

    this.jobs.set(schedule.id, task);
    console.log(`Scheduled ${schedule.name}: ${schedule.cron}`);
  }

  async executeSchedule(schedule) {
    try {
      const source = this.engine.config.sources.find(s => s.id === schedule.sourceId);
      const destination = this.engine.config.destinations.find(d => d.id === schedule.destinationId);

      if (!source || !destination) {
        console.error(`Schedule ${schedule.id}: Source or destination not found`);
        return;
      }

      await this.engine.runBackup(source, destination, schedule.backupType, {
        type: 'log',
        message: `Scheduled backup: ${schedule.name}`,
      });

      schedule.lastRun = new Date();
      const next = cron.parseExpression(schedule.cron);
      const now = new Date();
      const nextRun = next.next(now, true);
      if (nextRun) {
        schedule.nextRun = nextRun;
      }
    } catch (error) {
      console.error(`Schedule ${schedule.id} failed:`, error.message);
    }
  }

  getAllSchedules() {
    return [...this.schedules];
  }

  getSchedule(id) {
    return this.schedules.find(s => s.id === id);
  }

  addSchedule(schedule) {
    this.schedules.push(schedule);
    if (schedule.enabled) {
      this.scheduleJob(schedule);
    }
  }

  updateSchedule(id, updates) {
    const schedule = this.schedules.find(s => s.id === id);
    if (!schedule) return false;

    const wasEnabled = schedule.enabled;
    Object.assign(schedule, updates);

    if (wasEnabled !== schedule.enabled) {
      if (wasEnabled) {
        const job = this.jobs.get(id);
        if (job) job.stop();
        this.jobs.delete(id);
      } else {
        this.scheduleJob(schedule);
      }
    } else if (wasEnabled && schedule.enabled) {
      const job = this.jobs.get(id);
      if (job) job.stop();
      this.jobs.delete(id);
      this.scheduleJob(schedule);
    }

    return true;
  }

  deleteSchedule(id) {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;

    const job = this.jobs.get(id);
    if (job) job.stop();
    this.jobs.delete(id);

    this.schedules.splice(index, 1);
    return true;
  }

  stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
  }
}