import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import type { UpdateDriverProfileDto } from './drivers/dtos/update-driver-profile.dto';

@Injectable()
export class StaffAccountUpdater {
  private readonly logger = new Logger(StaffAccountUpdater.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async update(
    userId: number,
    businessId: number,
    dto: UpdateDriverProfileDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, isDeleted: false },
      include: { phoneNumber: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    const email = dto.email?.trim();
    const changingEmail = email !== undefined && email !== user.email;
    if (
      changingEmail &&
      (await this.prisma.user.findFirst({
        where: { email, id: { not: userId } },
      }))
    )
      throw new ConflictException({
        code: 'STAFF_EMAIL_EXISTS',
        message: 'Email already exists',
      });
    const phone =
      dto.phoneNumber !== undefined || dto.phoneCountryCode !== undefined
        ? {
            countryCode:
              dto.phoneCountryCode ?? user.phoneNumber?.countryCode ?? '+380',
            number: dto.phoneNumber ?? user.phoneNumber?.number ?? '',
          }
        : undefined;
    if (
      phone &&
      (!/^\+[1-9]\d{0,3}$/.test(phone.countryCode) ||
        !/^\d+$/.test(phone.number) ||
        (phone.countryCode === '+380' && phone.number.length !== 9) ||
        (phone.countryCode === '+44' && phone.number.length !== 10) ||
        phone.countryCode.length - 1 + phone.number.length > 15)
    )
      throw new BadRequestException('Invalid phone number');
    for (const value of [dto.firstName, dto.lastName])
      if (value !== undefined && !value.trim())
        throw new BadRequestException('Name cannot be empty');
    const credentialsChanged = changingEmail || !!dto.password;
    const auth = credentialsChanged
      ? await this.prisma.authProfile.findFirst({
          where: { userId, provider: 'Supabase' },
        })
      : null;
    if (credentialsChanged && !auth)
      throw new ConflictException({
        code: 'STAFF_AUTH_MISSING',
        message: 'Login identity is missing',
      });
    let previousEmail: string | undefined;
    if (auth) {
      const before = await this.supabase.client.auth.admin.getUserById(
        auth.providerId,
      );
      if (before.error || !before.data.user)
        throw new BadRequestException({
          code: 'STAFF_AUTH_UPDATE_FAILED',
          message: 'Cannot read login identity',
        });
      previousEmail = before.data.user.email;
      const { error } = await this.supabase.client.auth.admin.updateUserById(
        auth.providerId,
        {
          ...(changingEmail ? { email, email_confirm: true } : {}),
          ...(dto.password ? { password: dto.password } : {}),
        },
      );
      if (error)
        throw new BadRequestException({
          code: 'STAFF_AUTH_UPDATE_FAILED',
          message: 'Cannot update login identity',
        });
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const contact = phone
          ? await tx.phone.upsert({
              where: { countryCode_number: phone },
              create: phone,
              update: {},
            })
          : undefined;
        await tx.user.update({
          where: { id: userId, businessId },
          data: {
            ...(dto.firstName !== undefined
              ? { firstName: dto.firstName.trim() }
              : {}),
            ...(dto.lastName !== undefined
              ? { lastName: dto.lastName.trim() }
              : {}),
            ...(email !== undefined ? { email } : {}),
            ...(contact ? { phoneId: contact.id } : {}),
          },
        });
        if (changingEmail && auth)
          await tx.authProfile.update({
            where: { id: auth.id },
            data: { email },
          });
      });
    } catch (error) {
      let compensationFailed = false;
      if (changingEmail && auth && previousEmail) {
        try {
          const restored = await this.supabase.client.auth.admin.updateUserById(
            auth.providerId,
            { email: previousEmail, email_confirm: true },
          );
          compensationFailed = !!restored.error;
        } catch {
          compensationFailed = true;
        }
      } else if (changingEmail) compensationFailed = true;
      if (compensationFailed)
        this.logger.error(
          `Login email reconciliation required for account ${userId}`,
        );
      // Passwords cannot be rolled back; explicitly report this partial outcome.
      if (compensationFailed || dto.password)
        throw new ConflictException({
          code: 'STAFF_AUTH_PARTIAL_UPDATE',
          message:
            'Login credentials changed but account details were not saved',
        });
      if (error?.code === 'P2002')
        throw new ConflictException({
          code: 'STAFF_EMAIL_EXISTS',
          message: 'Email already exists',
        });
      throw error;
    }
  }
}
