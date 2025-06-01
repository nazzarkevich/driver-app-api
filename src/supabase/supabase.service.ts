import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_KEY',
    );

    if (!supabaseUrl) {
      this.logger.error(
        'SUPABASE_URL is not defined in environment variables.',
      );
      throw new Error('SUPABASE_URL is not defined.');
    }
    if (!supabaseServiceKey) {
      this.logger.error(
        'SUPABASE_SERVICE_KEY is not defined in environment variables.',
      );
      throw new Error('SUPABASE_SERVICE_KEY is not defined.');
    }

    this._supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.logger.log('Supabase client initialized successfully.');
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
}
