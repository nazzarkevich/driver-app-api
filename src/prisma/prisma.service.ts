import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    this.logger.log(`DATABASE_URL is ${databaseUrl ? 'SET' : 'NOT SET'}`);

    if (!databaseUrl) {
      this.logger.error(
        'DATABASE_URL is not defined in environment variables.',
      );

      throw new Error('DATABASE_URL is not defined.');
    }

    // Mask password for safe logging
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
    this.logger.log(`DATABASE_URL format: ${maskedUrl}`);

    try {
      this.logger.log('Attempting to connect to database...');

      await this.$connect();

      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error.message);

      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');

    await this.$disconnect();

    this.logger.log('Database disconnected');
  }
}
