import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsCityOrVillage(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isCityOrVillage',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const hasCity = !!obj.city;
          const hasVillage = !!obj.village;

          return hasCity !== hasVillage;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either city or village must be provided, but not both';
        },
      },
    });
  };
}
