import { registerDecorator, ValidationOptions } from 'class-validator';

// Shared by driver/courier creation and optional password changes.
export function IsStaffPassword(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isStaffPassword',
      target: target.constructor,
      propertyName,
      options: {
        message:
          'Password must contain at least 8 characters, uppercase and lowercase letters, a digit, and a special character',
        ...options,
      },
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            Array.from(value).length >= 8 &&
            /\p{Ll}/u.test(value) &&
            /\p{Lu}/u.test(value) &&
            /[0-9]/.test(value) &&
            /[^\p{L}\p{N}\s]/u.test(value)
          );
        },
      },
    });
  };
}
