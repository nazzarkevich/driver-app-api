import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidUkPostcode } from '../address-search/utils/uk-postcode';

export function IsAddressPostcode(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isAddressPostcode',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const country = (args.object as { countryIsoCode: string })
            .countryIsoCode;
          return country === 'GB'
            ? typeof value === 'string' && isValidUkPostcode(value)
            : value == null ||
                value === '' ||
                (typeof value === 'string' && /^\d{5}$/.test(value));
        },
        defaultMessage() {
          return 'Enter a valid postcode (required for Great Britain; five digits for Ukraine)';
        },
      },
    });
}
