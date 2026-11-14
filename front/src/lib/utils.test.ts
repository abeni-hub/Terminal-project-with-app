import { cn } from '@/lib/utils';

describe('cn helper', () => {
  it('combines class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
});
