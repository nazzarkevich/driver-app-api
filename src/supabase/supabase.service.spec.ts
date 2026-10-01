import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseService', () => {
  const client = { auth: {} };
  const mockedCreateClient = createClient as jest.MockedFunction<
    typeof createClient
  >;

  beforeEach(() => {
    mockedCreateClient.mockReset();
    mockedCreateClient.mockReturnValue(client as any);
  });

  it('creates server clients without persistent or automatic auth sessions', () => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'service-key',
      ),
    } as unknown as ConfigService;
    const service = new SupabaseService(configService);

    service.onModuleInit();
    const authClient = service.createAuthClient();

    expect(service.client).toBe(client);
    expect(authClient).toBe(client);
    expect(mockedCreateClient).toHaveBeenCalledTimes(2);
    expect(mockedCreateClient).toHaveBeenNthCalledWith(
      1,
      'https://example.supabase.co',
      'service-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
  });
});
