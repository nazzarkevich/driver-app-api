import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JourneyNumberService {
  constructor(private readonly prismaService: PrismaService) {}

  async generateJourneyNumber(
    departureDate: Date,
    businessId: number,
  ): Promise<string> {
    // Format date as YYYYMMDD
    const year = departureDate.getFullYear();
    const month = String(departureDate.getMonth() + 1).padStart(2, '0');
    const day = String(departureDate.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Get the start and end of the day for the departure date
    const startOfDay = new Date(
      year,
      departureDate.getMonth(),
      departureDate.getDate(),
    );
    const endOfDay = new Date(
      year,
      departureDate.getMonth(),
      departureDate.getDate() + 1,
    );

    // Find the highest sequence number for this date and business
    const existingJourneys = await this.prismaService.journey.findMany({
      where: {
        businessId,
        departureDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        isDeleted: false,
      },
      select: {
        journeyNumber: true,
      },
      orderBy: {
        journeyNumber: 'desc',
      },
    });

    let nextSequence = 1;

    if (existingJourneys.length > 0) {
      // Extract sequence numbers from existing journey numbers for this date
      const sequenceNumbers = existingJourneys
        .map((journey) => {
          if (journey.journeyNumber?.startsWith(datePrefix)) {
            const parts = journey.journeyNumber.split('-');
            const seq = parts.length === 2 ? parseInt(parts[1], 10) : 0;
            return seq;
          }
          return 0;
        })
        .filter((seq) => !isNaN(seq) && seq > 0);

      if (sequenceNumbers.length > 0) {
        nextSequence = Math.max(...sequenceNumbers) + 1;
      }
    }

    const journeyNumber = `${datePrefix}-${nextSequence}`;

    return journeyNumber;
  }

  async isJourneyNumberUnique(
    journeyNumber: string,
    businessId: number,
  ): Promise<boolean> {
    const existingJourney = await this.prismaService.journey.findFirst({
      where: {
        journeyNumber,
        businessId,
        isDeleted: false,
      },
    });

    return !existingJourney;
  }

  async generateUniqueJourneyNumber(
    departureDate: Date,
    businessId: number,
    maxRetries: number = 10,
  ): Promise<string> {
    // Validate inputs
    if (!departureDate || !(departureDate instanceof Date)) {
      throw new Error('Invalid departure date provided');
    }

    if (!businessId || typeof businessId !== 'number') {
      throw new Error('Invalid business ID provided');
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const journeyNumber = await this.generateJourneyNumber(
          departureDate,
          businessId,
        );

        if (!journeyNumber) {
          throw new Error('generateJourneyNumber returned null/undefined');
        }

        const isUnique = await this.isJourneyNumberUnique(
          journeyNumber,
          businessId,
        );

        if (isUnique) {
          return journeyNumber;
        }

        // If not unique, add a small delay and retry
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to generate unique journey number after ${maxRetries} attempts`,
    );
  }
}
