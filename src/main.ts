import 'dotenv/config'; // Importante para cargar las variables al arrancar
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });

  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  logger.log(`🚀 Servidor corriendo en: http://localhost:${port}/api`);
  logger.log(`✅ CORS habilitado para: ${frontendUrl}`);
}
bootstrap();
