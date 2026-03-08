// ============================================================================
// MEMORY QUEUE ADAPTER
// ============================================================================

import { QueueAdapter, Notification } from "../types";

export class MemoryQueueAdapter implements QueueAdapter {
  private queue: Notification[] = [];
  private delayedQueue: Array<{ notification: Notification; executeAt: Date }> = [];
  protected isRunning = false;
  private checkInterval?: any;

  async enqueue(notification: Notification): Promise<void> {
    this.queue.push(notification);
  }

  async enqueueBatch(notifications: Notification[]): Promise<void> {
    this.queue.push(...notifications);
  }

  async enqueueDelayed(notification: Notification, delay: number): Promise<void> {
    this.delayedQueue.push({
      notification,
      executeAt: new Date(Date.now() + delay)
    });
  }

  async dequeue(): Promise<Notification | null> {
    return this.queue.shift() || null;
  }

  async dequeueBatch(count: number): Promise<Notification[]> {
    return this.queue.splice(0, count);
  }

  async getQueueSize(): Promise<number> {
    return this.queue.length + this.delayedQueue.length;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.delayedQueue = [];
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.processDelayed();
    }, 1000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private processDelayed(): void {
    const now = new Date();
    const ready = this.delayedQueue.filter(item => item.executeAt <= now);
    
    ready.forEach(item => {
      this.queue.push(item.notification);
    });
    
    this.delayedQueue = this.delayedQueue.filter(item => item.executeAt > now);
  }
}
