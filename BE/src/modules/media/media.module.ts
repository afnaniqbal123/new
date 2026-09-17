import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MediaService } from './media.service';
import { CloudinaryProvider } from 'src/modules/media/providers/cloudinary.provider';
import { MediaController } from './media.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MediaController],
  providers: [MediaService, CloudinaryProvider, ConfigService],
  exports: [MediaService],
})
export class MediaModule {}
