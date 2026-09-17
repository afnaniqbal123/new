import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/**
 * Live delivery to connected browsers.
 *
 * Split out because connection lifecycle changes for entirely different
 * reasons than notification storage does — and because it is the one part of
 * this module that is process-local. Everything here lives in memory: a
 * second instance of the app has its own map and its own connected clients.
 *
 * That constraint is contained to this file on purpose. Moving to Redis
 * pub/sub later means replacing this service, not unpicking delivery from
 * persistence across the module.
 */
@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  /** userId -> the stream that user's open connections are reading. */
  private readonly clients = new Map<string, Subject<MessageEvent>>();

  /**
   * Open a stream for a user. The returned observable unsubscribes and drops
   * the entry when the client disconnects, so a browser closing its tab does
   * not leak a Subject.
   */
  subscribe(userId: string): Observable<MessageEvent> {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Subject<MessageEvent>());
    }

    const subject = this.clients.get(userId)!;

    return new Observable<MessageEvent>((observer) => {
      const subscription = subject.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this.clients.delete(userId);
      };
    });
  }

  /**
   * Push to one user if they happen to be connected. Silent when they are
   * not: delivery is best-effort by nature, and the stored notification is
   * what makes it durable.
   */
  emitTo(userId: string, data: unknown): void {
    this.clients.get(userId)?.next({ data } as MessageEvent);
  }

  broadcast(data: unknown): void {
    for (const subject of this.clients.values()) {
      subject.next({ data } as MessageEvent);
    }
  }

  /** Whether a user currently has an open stream. */
  isConnected(userId: string): boolean {
    return this.clients.has(userId);
  }

  onModuleDestroy(): void {
    for (const subject of this.clients.values()) {
      subject.complete();
    }
    this.clients.clear();
  }
}
