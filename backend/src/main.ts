// NestJS bootstrap entrypoint — creates the app, wires global config, starts listening.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = resolveCorsOrigin();
  if (origin) {
    app.enableCors({
      origin,
      methods: ['GET', 'POST', 'OPTIONS'],
    });
  }
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
