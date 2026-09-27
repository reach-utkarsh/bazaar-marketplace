import { testUser } from '../../test/utils';
import { postLoginPath } from './redirect';

describe('postLoginPath', () => {
  it('honours safe relative redirects', () => {
    expect(postLoginPath(testUser(), '/cart')).toBe('/cart');
  });
  it('rejects protocol-relative open redirects', () => {
    expect(postLoginPath(testUser(), '//evil.com')).toBe('/');
  });
  it('routes by role when there is no redirect', () => {
    expect(postLoginPath(testUser({ role: 'ADMIN' }), null)).toBe('/admin');
    expect(postLoginPath(testUser({ role: 'VENDOR', vendor: { id: 'v', slug: 's', storeName: 'S', status: 'APPROVED' } }), null)).toBe('/vendor');
  });
});
