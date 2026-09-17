import { getPageCount } from './getPageCount';

describe('getPageCount', () => {
  it('rounds up to the next page when items overflow an even page', () => {
    expect(getPageCount(25, 10)).toBe(3);
  });

  it('returns an exact page count when total divides evenly by pageSize', () => {
    expect(getPageCount(20, 10)).toBe(2);
  });

  it('returns 1 page (not 0) when there are zero items', () => {
    expect(getPageCount(0, 10)).toBe(1);
  });

  it('returns 0 when pageSize is 0', () => {
    expect(getPageCount(25, 0)).toBe(0);
  });

  it('returns 0 when pageSize is negative', () => {
    expect(getPageCount(25, -5)).toBe(0);
  });
});
