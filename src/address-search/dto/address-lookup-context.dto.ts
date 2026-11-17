import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AddressLookupContextDto {
  @IsIn(['GB', 'UA'])
  countryCode: 'GB' | 'UA' = 'GB';

  @IsOptional()
  @IsIn(['google-places'])
  provider?: 'google-places';

  @ValidateIf(
    (value) =>
      value.countryCode === 'UA' ||
      value.provider === 'google-places' ||
      value.sessionToken !== undefined,
  )
  @IsUUID('4')
  sessionToken?: string;
}
