import { BadGatewayException, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

describe('address lookup audit privacy', () => {
  it('redacts query text, tokens and place identifiers from failed lookups', async () => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor({ log } as any);
    const request = {
      method: 'GET',
      path: '/address-search/secret-place',
      url: '/address-search/secret-place?query=secret-address&sessionToken=secret-token',
      query: {
        query: 'secret-address',
        sessionToken: 'secret-token',
        provider: 'google-places',
        countryCode: 'GB',
      },
      params: { id: 'secret-place' },
      body: {},
      ip: '127.0.0.1',
      get: () => 'test',
      currentUser: { id: 7 },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 502 }),
      }),
    } as unknown as ExecutionContext;
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () =>
            throwError(() => new BadGatewayException('secret-diagnostic')),
        }),
      ),
    ).rejects.toThrow();
    expect(log).toHaveBeenCalled();
    const audit = log.mock.calls[0][0];
    const serialized = JSON.stringify(audit);
    for (const sensitive of [
      'secret-address',
      'secret-place',
      'secret-token',
      'secret-diagnostic',
    ])
      expect(serialized).not.toContain(sensitive);
    expect(audit.statusCode).toBe(502);
    expect(audit.endpoint).toBe('/address-search/[redacted]');
  });
});
