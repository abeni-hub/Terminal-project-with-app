import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());

  // CORS – allow the Next.js frontend to connect
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Addis Ababa Transport Office – Terminal Roster API')
    .setDescription('Enterprise backend for the Terminal Digital Roster System')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('RBAC - Roles & Permissions')
    .addTag('User Management')
    .addTag('Terminal Management')
    .addTag('Route Management')
    .addTag('Vehicle Groups')
    .addTag('Vehicle Management')
    .addTag('Dispatch Fees')
    .addTag('Weekly Route Assignments')
    .addTag('Queue & Dispatch')
    .addTag('Violations')
    .addTag('Supervisor Overrides')
    .addTag('Audit Logs')
    .addTag('Device Management')
    .addTag('Dashboard')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n🚀 AATO Roster API running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at:          http://localhost:${port}/api/docs\n`);
}

bootstrap();
