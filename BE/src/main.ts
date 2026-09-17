import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from 'src/app.module';
import { CustomValidationPipe } from 'src/guards/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    // Required by every webhook that verifies a signature — Stripe's and
    // WhatsApp's both hash the *exact* bytes that were sent. Without this,
    // `req.rawBody` is undefined and signature checks silently cannot run,
    // which makes the endpoint forgeable by anyone who knows the URL.
    rawBody: true,
  });

  const config = new DocumentBuilder()
    .setTitle('BusinessOS API')
    .setDescription(
      'Operations platform for distributors and small retail chains. ' +
        'Every monetary value is an integer in the organization currency’s ' +
        'minor units — see CONTEXT.md D4.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
    },
  });

  app.useGlobalPipes(
    new CustomValidationPipe({
      whitelist: true,
    }),
  );

  await app.listen(process.env.PORT || 8080, () => {
    console.log(`Server is running on port ${process.env.PORT || 8080}`);
  });
}
bootstrap();
