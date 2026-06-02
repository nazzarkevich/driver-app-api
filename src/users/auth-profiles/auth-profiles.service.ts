import { Injectable, Logger } from '@nestjs/common';
import { AuthProfile, AuthProvider } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthProfilesService {
  private readonly logger = new Logger(AuthProfilesService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async findByProviderId(supabaseId: string): Promise<AuthProfile | null> {
    try {
      return await this.prismaService.authProfile.findUnique({
        where: {
          provider_providerId: {
            provider: AuthProvider.Supabase,
            providerId: supabaseId,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error finding auth profile by providerId: ${error.message}`,
      );
      throw error;
    }
  }

  async findByUserId(userId: number): Promise<AuthProfile | null> {
    try {
      return await this.prismaService.authProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Error finding auth profile by userId: ${error.message}`,
      );
      throw error;
    }
  }

  async createOrUpdate(
    userId: number,
    supabaseId: string,
    provider: AuthProvider,
    lastSignIn?: Date,
    email?: string,
    phone?: string,
  ): Promise<AuthProfile> {
    try {
      return await this.prismaService.authProfile.upsert({
        where: {
          provider_providerId: {
            provider,
            providerId: supabaseId,
          },
        },
        update: {
          lastSignIn: lastSignIn || new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider,
          providerId: supabaseId,
          email,
          phone,
          lastSignIn: lastSignIn || new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error creating/updating auth profile: ${error.message}`,
      );
      throw error;
    }
  }

  async updateLastSignIn(supabaseId: string): Promise<void> {
    try {
      await this.prismaService.authProfile.updateMany({
        where: { providerId: supabaseId, provider: AuthProvider.Supabase },
        data: { lastSignIn: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Error updating last sign-in for supabaseId ${supabaseId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getAll(): Promise<AuthProfile[]> {
    try {
      return await this.prismaService.authProfile.findMany({
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error fetching all auth profiles: ${error.message}`);
      throw error;
    }
  }
}
