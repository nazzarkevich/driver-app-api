import * as fs from 'fs';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerDocumentOptions,
} from '@nestjs/swagger';
import {
  ClassSerializerInterceptor,
  HttpException,
  HttpStatus,
  Logger,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

import { AppModule } from './app.module';
import { getAllConstraints, getCustomValidationError } from '../utils';
import { HttpExceptionFilter } from './exception-filters/http-exception.fiter';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync('./privkey.pem'),
    cert: fs.readFileSync('./fullchain.pem'),
  };
  const app = await NestFactory.create(AppModule, { httpsOptions });
  const loggerInstance = app.get(Logger);

  const config = new DocumentBuilder()
    .setTitle('Driver API')
    .setDescription('Driver API description')
    .setVersion('1.0')
    .build();
  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };
  const document = SwaggerModule.createDocument(app, config, options);

  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new HttpException(
          getCustomValidationError(getAllConstraints(errors)),
          HttpStatus.BAD_REQUEST,
        ),
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalFilters(new HttpExceptionFilter(loggerInstance));

  await app.listen(3000);
}

bootstrap();
