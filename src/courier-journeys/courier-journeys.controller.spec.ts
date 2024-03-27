import { Test, TestingModule } from '@nestjs/testing';
import { CourierJourneysController } from './courier-journeys.controller';

describe('CourierJourneysController', () => {
  let controller: CourierJourneysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourierJourneysController],
    }).compile();

    controller = module.get<CourierJourneysController>(CourierJourneysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
