import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NovaPostWarehouse, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchNovaPostWarehousesDto } from './dtos/search-warehouses.dto';
import { SearchNovaPostCitiesDto } from './dtos/search-cities.dto';

type NovaPostApiResponse = {
  success: boolean;
  data?: Record<string, unknown>[];
  errors?: string[];
  info?: { totalCount?: number | string };
};

export type WarehouseSearchResult = {
  items: NovaPostWarehouse[];
  totalCount: number;
  page: number;
  limit: number;
  source: 'provider' | 'cache';
  stale: boolean;
};

export type NovaPostCityOption = {
  cityRef: string;
  settlementRef: string;
  name: string;
  displayName: string;
  areaName?: string;
  regionName?: string;
  settlementType?: string;
  warehouseCount: number;
};

export type CitySearchResult = {
  items: NovaPostCityOption[];
  totalCount: number;
  page: number;
  limit: number;
  source: 'provider' | 'cache';
  stale: boolean;
};

@Injectable()
export class NovaPostService {
  private readonly logger = new Logger(NovaPostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async searchCities(
    query: SearchNovaPostCitiesDto,
  ): Promise<CitySearchResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    try {
      const response = await this.fetchCities(query.search, page, limit);
      const firstResult = response.data?.[0] ?? {};
      const addresses = Array.isArray(firstResult.Addresses)
        ? (firstResult.Addresses as Record<string, unknown>[])
        : [];
      const uniqueCities = new Map<string, NovaPostCityOption>();

      for (const address of addresses) {
        const cityRef = this.optionalString(address.DeliveryCity);
        const settlementRef = this.optionalString(address.Ref);
        const name = this.optionalString(address.MainDescription);
        if (!cityRef || !settlementRef || !name || uniqueCities.has(cityRef)) {
          continue;
        }

        uniqueCities.set(cityRef, {
          cityRef,
          settlementRef,
          name,
          displayName: this.optionalString(address.Present) ?? name,
          areaName: this.optionalString(address.Area),
          regionName: this.optionalString(address.Region),
          settlementType: this.optionalString(address.SettlementTypeCode),
          warehouseCount: Number(address.Warehouses ?? 0),
        });
      }

      const items = [...uniqueCities.values()];
      return {
        items,
        totalCount: Number(firstResult.TotalCount ?? items.length),
        page,
        limit,
        source: 'provider',
        stale: false,
      };
    } catch (error) {
      this.logger.warn(
        `Nova Post city search failed; serving cache: ${error.message}`,
      );
      return this.searchCityCache(query.search, page, limit);
    }
  }

  async searchWarehouses(
    query: SearchNovaPostWarehousesDto,
  ): Promise<WarehouseSearchResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    try {
      const response = await this.fetchWarehouses(query, page, limit);
      const rows = response.data ?? [];
      const operations = rows.map((row) => {
        const data = this.mapWarehouse(row);
        return this.prisma.novaPostWarehouse.upsert({
          where: { externalRef: data.externalRef },
          create: data,
          update: data,
        });
      });
      const items =
        operations.length > 0 ? await this.prisma.$transaction(operations) : [];

      return {
        items,
        totalCount: Number(response.info?.totalCount ?? items.length),
        page,
        limit,
        source: 'provider',
        stale: false,
      };
    } catch (error) {
      this.logger.warn(
        `Nova Post warehouse search failed; serving cache: ${error.message}`,
      );
      return this.searchCache(query, page, limit);
    }
  }

  private async fetchCities(
    search: string,
    page: number,
    limit: number,
  ): Promise<NovaPostApiResponse> {
    const url = this.config.get<string>(
      'NOVA_POST_API_URL',
      'https://api.novaposhta.ua/v2.0/json/',
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          apiKey: this.config.get<string>('NOVA_POST_API_KEY', ''),
          modelName: 'AddressGeneral',
          calledMethod: 'searchSettlements',
          methodProperties: {
            CityName: search,
            Page: String(page),
            Limit: String(limit),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Provider returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as NovaPostApiResponse;
      if (!payload.success) {
        throw new Error(
          payload.errors?.join(', ') || 'Provider request failed',
        );
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchWarehouses(
    query: SearchNovaPostWarehousesDto,
    page: number,
    limit: number,
  ): Promise<NovaPostApiResponse> {
    const url = this.config.get<string>(
      'NOVA_POST_API_URL',
      'https://api.novaposhta.ua/v2.0/json/',
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          apiKey: this.config.get<string>('NOVA_POST_API_KEY', ''),
          modelName: 'AddressGeneral',
          calledMethod: 'getWarehouses',
          methodProperties: {
            Page: String(page),
            Limit: String(limit),
            ...(query.search ? { FindByString: query.search.trim() } : {}),
            ...(query.cityRef ? { CityRef: query.cityRef } : {}),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Provider returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as NovaPostApiResponse;
      if (!payload.success) {
        throw new Error(
          payload.errors?.join(', ') || 'Provider request failed',
        );
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapWarehouse(
    row: Record<string, unknown>,
  ): Prisma.NovaPostWarehouseUncheckedCreateInput {
    const externalRef = this.requiredString(row.Ref, 'Ref');
    const name = this.requiredString(row.Description, 'Description');
    const cityName =
      this.optionalString(row.SettlementDescription) ??
      this.requiredString(row.CityDescription, 'CityDescription');

    return {
      externalRef,
      cityRef: this.optionalString(row.CityRef),
      areaRef: this.optionalString(row.AreaRef),
      regionRef: this.optionalString(row.RegionRef),
      warehouseNumber: this.optionalString(row.Number),
      name,
      shortAddress: this.optionalString(row.ShortAddress),
      cityName,
      areaName: this.optionalString(row.SettlementAreaDescription),
      regionName: this.optionalString(row.SettlementRegionsDescription),
      warehouseType: this.optionalString(row.TypeOfWarehouse),
      isActive:
        this.optionalString(row.WarehouseStatus) === 'Working' &&
        this.optionalString(row.DenyToSelect) !== '1',
      providerData: row as Prisma.InputJsonValue,
    };
  }

  private async searchCache(
    query: SearchNovaPostWarehousesDto,
    page: number,
    limit: number,
  ): Promise<WarehouseSearchResult> {
    const search = query.search?.trim();
    const where: Prisma.NovaPostWarehouseWhereInput = {
      ...(query.cityRef ? { cityRef: query.cityRef } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { shortAddress: { contains: search, mode: 'insensitive' } },
              { cityName: { contains: search, mode: 'insensitive' } },
              { warehouseNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.novaPostWarehouse.findMany({
        where,
        orderBy: [{ cityName: 'asc' }, { warehouseNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.novaPostWarehouse.count({ where }),
    ]);
    return { items, totalCount, page, limit, source: 'cache', stale: true };
  }

  private async searchCityCache(
    search: string,
    page: number,
    limit: number,
  ): Promise<CitySearchResult> {
    const warehouses = await this.prisma.novaPostWarehouse.findMany({
      where: {
        cityRef: { not: null },
        OR: [
          { cityName: { contains: search, mode: 'insensitive' } },
          { areaName: { contains: search, mode: 'insensitive' } },
          { regionName: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: {
        cityRef: true,
        cityName: true,
        areaName: true,
        regionName: true,
        providerData: true,
      },
      orderBy: { cityName: 'asc' },
    });

    const cities = new Map<string, NovaPostCityOption>();
    for (const warehouse of warehouses) {
      if (!warehouse.cityRef) continue;
      const existing = cities.get(warehouse.cityRef);
      if (existing) {
        existing.warehouseCount += 1;
        continue;
      }

      const providerData =
        warehouse.providerData &&
        typeof warehouse.providerData === 'object' &&
        !Array.isArray(warehouse.providerData)
          ? (warehouse.providerData as Record<string, unknown>)
          : {};
      cities.set(warehouse.cityRef, {
        cityRef: warehouse.cityRef,
        settlementRef:
          this.optionalString(providerData.SettlementRef) ?? warehouse.cityRef,
        name: warehouse.cityName,
        displayName:
          this.optionalString(providerData.CityDescription) ??
          warehouse.cityName,
        areaName: warehouse.areaName ?? undefined,
        regionName: warehouse.regionName ?? undefined,
        settlementType: this.optionalString(
          providerData.SettlementTypeDescription,
        ),
        warehouseCount: 1,
      });
    }

    const allCities = [...cities.values()];
    return {
      items: allCities.slice((page - 1) * limit, page * limit),
      totalCount: allCities.length,
      page,
      limit,
      source: 'cache',
      stale: true,
    };
  }

  private requiredString(value: unknown, field: string): string {
    const result = this.optionalString(value);
    if (!result) throw new Error(`Provider result is missing ${field}`);
    return result;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
