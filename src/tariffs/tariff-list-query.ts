import { BadRequestException } from '@nestjs/common';

export interface TariffListFilters {
  page?: number;
  limit?: number;
  search?: string;
  tariffGroupId?: number;
  isActive?: boolean;
}
export function parseTariffListQuery(
  query: Record<string, string | undefined>,
): TariffListFilters {
  const integer = (key: string, max = Number.MAX_SAFE_INTEGER) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (
      typeof value !== 'string' ||
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > max
    )
      throw new BadRequestException(`Invalid ${key}`);
    return Number(value);
  };
  const boolean = (key: string) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (value !== 'true' && value !== 'false')
      throw new BadRequestException(`Invalid ${key}`);
    return value === 'true';
  };
  if (query.search !== undefined && typeof query.search !== 'string')
    throw new BadRequestException('Invalid search');
  const activeOnly = boolean('activeOnly');
  return {
    page: integer('page'),
    limit: integer('limit', 100),
    tariffGroupId: integer('tariffGroupId'),
    search: query.search?.trim() || undefined,
    isActive: boolean('isActive') ?? (activeOnly ? true : undefined),
  };
}
