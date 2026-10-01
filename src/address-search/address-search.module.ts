import { Module } from '@nestjs/common';
import { AddressSearchController } from './address-search.controller';
import { AddressSearchService } from './address-search.service';
import { AddressSearchCache } from './address-search.cache';
import { AddressSearchRateLimitGuard } from './address-search-rate-limit.guard';
import {
  ADDRESS_PROVIDER,
  POSTCODE_PROVIDER,
} from './providers/address-provider.interface';
import { IdealPostcodesProvider } from './providers/ideal-postcodes.provider';
import { PostcodesIoProvider } from './providers/postcodes-io.provider';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [AddressSearchController],
  providers: [
    AddressSearchService,
    AddressSearchCache,
    AddressSearchRateLimitGuard,
    IdealPostcodesProvider,
    PostcodesIoProvider,
    {
      provide: ADDRESS_PROVIDER,
      inject: [ConfigService, IdealPostcodesProvider],
      useFactory: (
        configService: ConfigService,
        idealPostcodesProvider: IdealPostcodesProvider,
      ) => {
        const provider = configService.get<string>(
          'ADDRESS_LOOKUP_PROVIDER',
          'ideal-postcodes',
        );
        if (provider !== 'ideal-postcodes') {
          throw new Error(`Unsupported address lookup provider: ${provider}`);
        }
        return idealPostcodesProvider;
      },
    },
    { provide: POSTCODE_PROVIDER, useExisting: PostcodesIoProvider },
  ],
  exports: [AddressSearchService],
})
export class AddressSearchModule {}
