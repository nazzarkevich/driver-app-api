import { Test, TestingModule } from '@nestjs/testing';
import { CourierJourneysService } from './courier-journeys.service';

describe('CourierJourneysService', () => {
  let service: CourierJourneysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CourierJourneysService],
    }).compile();

    service = module.get<CourierJourneysService>(CourierJourneysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
