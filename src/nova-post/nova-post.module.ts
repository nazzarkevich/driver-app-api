import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NovaPostController } from './nova-post.controller';
import { NovaPostService } from './nova-post.service';

@Module({
  imports: [PrismaModule],
  controllers: [NovaPostController],
  providers: [NovaPostService],
  exports: [NovaPostService],
})
export class NovaPostModule {}
