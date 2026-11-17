import { createCorsOptions } from './cors.config';

describe('admin panel CORS', () => {
  it('allows only exact configured origins', () => {
    const { origin } = createCorsOptions(
      'http://localhost:3001, https://admin.example.com ',
    );
    if (typeof origin !== 'function')
      throw new Error('Expected dynamic origin check');
    const callback = jest.fn();
    origin('https://admin.example.com', callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);
    origin('https://admin.example.com.attacker.test', callback);
    expect(callback).toHaveBeenLastCalledWith(null, false);
    origin(undefined, callback);
    expect(callback).toHaveBeenLastCalledWith(null, false);
  });
  it('does not enable browser access without configuration', () => {
    const { origin } = createCorsOptions();
    if (typeof origin !== 'function')
      throw new Error('Expected dynamic origin check');
    const callback = jest.fn();
    origin('http://localhost:3001', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
