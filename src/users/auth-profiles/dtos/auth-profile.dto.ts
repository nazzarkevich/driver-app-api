import { AuthProfile } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

@Expose()
export class AuthProfileDto {
  @ApiProperty({
    example: 1,
    description: 'AuthProfile ID',
  })
  id: number;

  @ApiProperty({
    example: 'abc123-def456-ghi789',
    description: 'Supabase user ID',
  })
  supabaseId: string;

  @ApiProperty({
    example: 'email',
    description: 'Authentication provider (email, google, facebook, etc.)',
  })
  provider: string;

  @ApiProperty({
    example: '2025-05-15T10:30:00Z',
    description: 'Last sign-in date and time',
    nullable: true,
  })
  lastSignIn: Date | null;

  @ApiProperty({
    example: '2025-05-01T08:00:00Z',
    description: 'When the auth profile was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-05-15T10:30:00Z',
    description: 'When the auth profile was last updated',
  })
  updatedAt: Date;

  constructor(authProfile: AuthProfile) {
    this.id = authProfile.id;
    this.supabaseId = authProfile.supabaseId;
    this.provider = authProfile.provider;
    this.lastSignIn = authProfile.lastSignIn;
    this.createdAt = authProfile.createdAt;
    this.updatedAt = authProfile.updatedAt;
  }
}
