import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _supabase: SupabaseClient;
  private supabaseUrl: string;
  private supabaseServiceKey: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    this.supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_KEY',
    );

    if (!this.supabaseUrl) {
      this.logger.error(
        'SUPABASE_URL is not defined in environment variables.',
      );
      throw new Error('SUPABASE_URL is not defined.');
    }
    if (!this.supabaseServiceKey) {
      this.logger.error(
        'SUPABASE_SERVICE_KEY is not defined in environment variables.',
      );
      throw new Error('SUPABASE_SERVICE_KEY is not defined.');
    }

    this._supabase = this.createStatelessClient();
    this.logger.log('Supabase client initialized successfully.');
  }

  /**
   * Auth clients hold session state internally. Use a new client for every
   * operation which creates or rotates a user session so one API request can
   * never reuse another user's in-flight refresh operation.
   */
  createAuthClient(): SupabaseClient {
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Supabase client not initialized.');
    }

    return this.createStatelessClient();
  }

  get client(): SupabaseClient {
    if (!this._supabase) {
      this.logger.error(
        'Supabase client accessed before initialization or initialization failed.',
      );
      throw new Error('Supabase client not initialized.');
    }
    return this._supabase;
  }

  private createStatelessClient(): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
}
