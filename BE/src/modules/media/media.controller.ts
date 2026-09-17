import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Post } from '@nestjs/common';

import { MediaService } from './media.service';
import {
  BulkDeleteMediaDto,
  BulkPresignGetDto,
  BulkPresignUploadDto,
  DeleteMediaDto,
  PresignGetDto,
  PresignUploadDto,
} from './dto/presigned-url.dto';
import { FOLDER_NAME } from 'src/modules/media/constants/media.constant';

@Controller('mediabucket')
@ApiTags('Media Bucket')
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaBucketService: MediaService) {}

  @Post('presign-upload')
  @ApiOperation({
    summary:
      'Return a presigned PUT URL for a single file so the client can upload directly to S3',
  })
  async presignSingleUpload(@Body() payload: PresignUploadDto) {
    const { fileName, folderName, contentType } = payload;
    return this.mediaBucketService.generateUploadPresignedUrl(
      fileName,
      folderName,
      contentType,
    );
  }

  @Post('presign-upload/bulk')
  @ApiOperation({
    summary:
      'Return presigned PUT URLs for multiple files so the client can upload directly to S3',
  })
  async presignBulkUpload(@Body() payload: BulkPresignUploadDto) {
    const { fileNames, folderName, contentType } = payload;
    return this.mediaBucketService.generateBulkUploadPresignedUrls(
      fileNames,
      folderName,
      contentType,
    );
  }

  @Post('presign-download')
  @ApiOperation({
    summary:
      'Return a presigned GET URL so the client can download directly from S3',
  })
  async presignDownload(@Body() payload: PresignGetDto) {
    const { fileName, folderName } = payload;
    return this.mediaBucketService.generateGetPresignedUrl(
      fileName,
      folderName,
    );
  }

  @Post('presign-download/bulk')
  @ApiOperation({
    summary:
      'Return presigned GET URLs for multiple files so the client can download directly from S3',
  })
  async presignBulkDownload(@Body() payload: BulkPresignGetDto) {
    const { fileNames } = payload;

    return this.mediaBucketService.generateBulkGetPresignedUrls(
      fileNames,
      FOLDER_NAME.PROFILE,
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete an object from S3 by file name and optional folder',
  })
  async deleteFile(@Body() payload: DeleteMediaDto) {
    const { fileName, folderName } = payload;
    return this.mediaBucketService.deleteByFileName(fileName, folderName);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Delete multiple objects from S3 by file names',
  })
  async deleteBulk(@Body() payload: BulkDeleteMediaDto) {
    const { fileNames } = payload;
    return this.mediaBucketService.deleteManyByFileNames(
      fileNames,
      FOLDER_NAME.PROFILE,
    );
  }
}
