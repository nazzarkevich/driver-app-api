import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Debug: Check DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    this.logger.log(`DATABASE_URL is ${databaseUrl ? 'SET' : 'NOT SET'}`);

    if (databaseUrl) {
      // Mask password for safe logging
      const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
      this.logger.log(`DATABASE_URL format: ${maskedUrl}`);
    } else {
      this.logger.error('DATABASE_URL is missing!');
      throw new Error('DATABASE_URL environment variable is required');
    }

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
