import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthProfile } from '@prisma/client';

@Injectable()
export class AuthProfilesService {
  private readonly logger = new Logger(AuthProfilesService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async findBySupabaseId(supabaseId: string): Promise<AuthProfile | null> {
    try {
      return await this.prismaService.authProfile.findUnique({
        where: { supabaseId },
      });
    } catch (error) {
      this.logger.error(
        `Error finding auth profile by supabaseId: ${error.message}`,
      );
      throw error;
    }
  }

  async createOrUpdate(
    supabaseId: string,
    provider: string,
    lastSignIn?: Date,
  ): Promise<AuthProfile> {
    try {
      return await this.prismaService.authProfile.upsert({
        where: { supabaseId },
        update: {
          lastSignIn: lastSignIn || new Date(),
          updatedAt: new Date(),
        },
        create: {
          supabaseId,
          provider,
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

  async updateLastSignIn(supabaseId: string): Promise<AuthProfile> {
    try {
      return await this.prismaService.authProfile.update({
        where: { supabaseId },
        data: {
          lastSignIn: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Error updating last sign-in: ${error.message}`);
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
