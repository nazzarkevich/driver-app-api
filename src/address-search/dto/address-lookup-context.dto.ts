import { IsIn, IsUUID, ValidateIf } from 'class-validator';

export class AddressLookupContextDto {
  @IsIn(['GB', 'UA'])
  countryCode: 'GB' | 'UA' = 'GB';

  @ValidateIf(
    (value) => value.countryCode === 'UA' || value.sessionToken !== undefined,
  )
  @IsUUID('4')
  sessionToken?: string;
}
