import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { FOLDER_NAME } from 'src/modules/media/constants/media.constant';

export class PresignUploadDto {
  @ApiProperty({ description: 'File name including extension' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where the file resides',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;

  @ApiPropertyOptional({
    description: 'MIME type hint for the upload',
    example: 'image/png',
  })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class BulkPresignUploadDto {
  @ApiProperty({
    type: [String],
    description: 'Array of file names',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  fileNames: string[];

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where the files reside',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;

  @ApiPropertyOptional({
    description: 'MIME type hint for uploads',
    example: 'image/png',
  })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class PresignGetDto {
  @ApiProperty({ description: 'File name including extension' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where the file resides',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;
}

export class DeleteMediaDto {
  @ApiProperty({ description: 'File name to delete, including extension' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where the file resides',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;
}

export class BulkPresignGetDto {
  @ApiProperty({
    type: [String],
    description: 'Array of file names to fetch',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  fileNames: string[];

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where files reside',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;
}

export class BulkDeleteMediaDto {
  @ApiProperty({
    type: [String],
    description: 'Array of file names to delete',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  fileNames: string[];

  @ApiPropertyOptional({
    enum: FOLDER_NAME,
    description: 'Folder where files reside',
  })
  @IsOptional()
  @IsEnum(FOLDER_NAME)
  folderName?: FOLDER_NAME;
}
