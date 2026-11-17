import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsStreetOrLine1(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isStreetOrLine1',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(country: unknown, args: ValidationArguments) {
          if (country === 'UA') return true;
          const address = args.object as { street?: unknown; line1?: unknown };
          return [address.street, address.line1].some(
            (value) => typeof value === 'string' && !!value.trim(),
          );
        },
        defaultMessage() {
          return 'Street or first address line is required for UK addresses';
        },
      },
    });
  };
}
