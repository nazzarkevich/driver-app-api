import { AuthProfile, AuthProvider } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

@Expose()
export class AuthProfileDto {
  @ApiProperty({ example: 1, description: 'AuthProfile ID' })
  id: number;

  @ApiProperty({ example: 1, description: 'Linked user ID' })
  userId: number;

  @ApiProperty({ example: 'Supabase', description: 'Authentication provider' })
  provider: AuthProvider;

  @ApiProperty({
    example: 'abc123-def456-ghi789',
    description: 'Provider user ID',
  })
  providerId: string;

  @ApiProperty({ example: 'user@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+447950999888', nullable: true })
  phone: string | null;

  @ApiProperty({ example: '2025-05-15T10:30:00Z', nullable: true })
  lastSignIn: Date | null;

  @ApiProperty({ example: '2025-05-01T08:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-05-15T10:30:00Z' })
  updatedAt: Date;

  constructor(authProfile: AuthProfile) {
    this.id = authProfile.id;
    this.userId = authProfile.userId;
    this.provider = authProfile.provider;
    this.providerId = authProfile.providerId;
    this.email = authProfile.email;
    this.phone = authProfile.phone;
    this.lastSignIn = authProfile.lastSignIn;
    this.createdAt = authProfile.createdAt;
    this.updatedAt = authProfile.updatedAt;
  }
}
