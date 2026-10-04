import { describe, expect, it } from 'vitest';
import { NotificationQueue } from '../src/ui/NotificationQueue';

describe('消息提示佇列', () => {
  it('保留連續消息的順序，完整停留後才顯示下一則', () => {
    const queue = new NotificationQueue();
    queue.enqueue('獲得藥品');
    queue.enqueue('武功已習得');
    queue.enqueue('任務已更新');
    queue.update(3.4);
    expect(queue.current).toBe('獲得藥品');
    queue.update(0.4);
    expect(queue.current).toBe('武功已習得');
    expect(queue.elapsed).toBe(0);
    queue.update(4);
    expect(queue.current).toBe('任務已更新');
    queue.update(4);
    expect(queue.current).toBeNull();
  });
  it('重複的不可通行提示不延長停留，也不塞滿等待佇列', () => {
    const queue = new NotificationQueue();
    queue.enqueue('前路不通', true);
    queue.update(1);
    queue.enqueue('前路不通', true);
    expect(queue.elapsed).toBe(1);
    queue.enqueue('獲得銀兩');
    queue.enqueue('獲得銀兩');
    queue.update(3);
    expect(queue.current).toBe('獲得銀兩');
    queue.update(4);
    expect(queue.current).toBe('獲得銀兩');
    queue.update(4);
    expect(queue.current).toBeNull();
  });
});
