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
    const databaseUrl = configService.get<string>('DATABASE_URL');
    const isPgBouncer = databaseUrl?.includes('pgbouncer=true');

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        { level: 'query', emit: 'event' },
      ],
      errorFormat: 'pretty',
    });

    if (isPgBouncer) {
      this.logger.log(
        'PgBouncer detected - using connection pooling configuration',
      );
      this.$extends({
        query: {
          $allModels: {
            async $allOperations({ args, query }) {
              const start = performance.now();
              const result = await query(args);
              const duration = performance.now() - start;

              if (duration > 1000) {
                this.logger.warn(
                  `Slow query detected: ${duration.toFixed(2)}ms`,
                );
              }

              return result;
            },
          },
        },
      });
    }

    (this as any).$on('query', (e: any) => {
      if (e.duration > 1000) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
      }
    });
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

    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
    this.logger.log(`DATABASE_URL format: ${maskedUrl}`);

    const poolConfig = this.extractPoolConfig(databaseUrl);
    this.logger.log(
      `📊 Connection Pool Configuration: ${JSON.stringify(poolConfig)}`,
    );

    try {
      this.logger.log('Attempting to connect to database...');

      await this.$connect();

      this.logger.log('✅ Database connected successfully');

      await this.$queryRaw`SELECT 1 as connection_test`;
      this.logger.log('✅ Database query test passed');
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error.message);

      throw error;
    }
  }

  private extractPoolConfig(url: string): any {
    const urlParams = new URL(url);
    return {
      isPgBouncer: urlParams.searchParams.has('pgbouncer'),
      connectionLimit:
        urlParams.searchParams.get('connection_limit') || 'default (17)',
      poolTimeout:
        urlParams.searchParams.get('pool_timeout') || 'default (10s)',
      database: urlParams.pathname.replace('/', ''),
      host: urlParams.hostname,
      port: urlParams.port,
    };
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');

    await this.$disconnect();

    this.logger.log('Database disconnected');
  }
}
