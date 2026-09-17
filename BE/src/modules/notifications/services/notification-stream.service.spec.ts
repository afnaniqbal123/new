import { NotificationStreamService } from './notification-stream.service';

/**
 * Connection lifecycle, with no database anywhere in sight — the separation
 * this service exists to create.
 */
describe('NotificationStreamService', () => {
  let service: NotificationStreamService;

  beforeEach(() => {
    service = new NotificationStreamService();
  });

  it('delivers to a connected subscriber', (done) => {
    service.subscribe('user-1').subscribe((event) => {
      expect(event.data).toEqual({ message: 'hello' });
      done();
    });

    service.emitTo('user-1', { message: 'hello' });
  });

  it('drops messages for a user who is not connected', () => {
    expect(service.isConnected('nobody')).toBe(false);
    // Best-effort delivery: the stored notification is what makes it durable.
    expect(() => service.emitTo('nobody', { message: 'hello' })).not.toThrow();
  });

  it('does not deliver one user’s notification to another', () => {
    const received: unknown[] = [];
    service.subscribe('user-1').subscribe((e) => received.push(e.data));
    service.subscribe('user-2').subscribe();

    service.emitTo('user-2', { message: 'for user 2' });

    expect(received).toEqual([]);
  });

  it('reaches every connected user on broadcast', () => {
    const seen: string[] = [];
    service.subscribe('user-1').subscribe(() => seen.push('user-1'));
    service.subscribe('user-2').subscribe(() => seen.push('user-2'));

    service.broadcast({ message: 'everyone' });

    expect(seen.sort()).toEqual(['user-1', 'user-2']);
  });

  // A tab closing must not leave a Subject behind.
  it('forgets a subscriber once it unsubscribes', () => {
    const subscription = service.subscribe('user-1').subscribe();
    expect(service.isConnected('user-1')).toBe(true);

    subscription.unsubscribe();

    expect(service.isConnected('user-1')).toBe(false);
  });

  it('completes and clears every stream on shutdown', () => {
    let completed = false;
    service
      .subscribe('user-1')
      .subscribe({ complete: () => (completed = true) });

    service.onModuleDestroy();

    expect(completed).toBe(true);
    expect(service.isConnected('user-1')).toBe(false);
  });
});
