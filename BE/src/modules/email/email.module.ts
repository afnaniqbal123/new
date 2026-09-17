import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailService } from './services/email-service';
import { emailProviderFactory } from './providers/email-provider.factory';
import { MediaModule } from 'src/modules/media/media.module';

@Module({
  imports: [MediaModule],
  // Only `EmailService` is exported. The provider stays private: callers ask
  // for "send this email", never for "send this through SendGrid", which is
  // what lets the provider be swapped by configuration or removed at
  // generation without touching a single caller.
  providers: [EmailService, ConfigService, emailProviderFactory],
  exports: [EmailService],
})
export class EmailModule {}
