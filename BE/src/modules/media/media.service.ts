import {
  GetObjectCommand,
  PutObjectCommand,
  S3,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { CONFIG } from 'src/constants/config.constant';
import {
  AWS_ERROR,
  AWS_SUCCESS,
} from 'src/modules/media/constants/api-response/aws.response';
import { FOLDER_NAME } from 'src/modules/media/constants/media.constant';
import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { CloudinaryProvider } from 'src/modules/media/providers/cloudinary.provider';
import { MEDIA_PROVIDER } from 'src/modules/media/constants/media.constant';

@Injectable()
export class MediaService {
  /**
   * Built on first use, not in the constructor.
   *
   * The AWS SDK throws "Region is missing" the moment a client is constructed
   * without one — so eagerly creating these made the whole application
   * unbootable on a deployment that uses Cloudinary and has no AWS
   * credentials at all. Nest instantiates every provider at startup, so a
   * constructor that can throw is a constructor that can stop the product.
   */
  private s3Instance: S3 | null = null;
  private s3ClientInstance: S3Client | null = null;
  private readonly bucketName: string;
  private readonly expiresIn: number;
  private readonly maxPresignExpiry = 7 * 24 * 60 * 60; // 7 days

  /**
   * Which backend uploads actually go to.
   *
   * Read once at construction. Both providers are fully implemented for
   * upload and delete; presigned URLs remain S3-only — see
   * `CloudinaryProvider` for why that is deliberate rather than missing.
   * CONTEXT.md D11.
   */
  private readonly provider: MEDIA_PROVIDER;

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudinary: CloudinaryProvider,
  ) {
    this.provider =
      (this.configService.get<string>(
        CONFIG.MEDIA_PROVIDER,
      ) as MEDIA_PROVIDER) || MEDIA_PROVIDER.S3;

    this.bucketName =
      this.configService.get<string>(CONFIG.AWS_BUCKET_NAME) ?? '';
    this.expiresIn = Number(
      this.configService.get(CONFIG.AWS_EXPIRES_IN) ?? 3600,
    );
  }

  /** The S3 credentials, read at the moment a client is actually needed. */
  private get awsConfig(): {
    credentials: { accessKeyId: string; secretAccessKey: string };
    region: string;
  } {
    return {
      credentials: {
        accessKeyId: this.configService.get(CONFIG.AWS_ACCESS_KEY_ID) ?? '',
        secretAccessKey:
          this.configService.get(CONFIG.AWS_SECRET_ACCESS_KEY) ?? '',
      },
      region: this.configService.get(CONFIG.AWS_REGION) ?? '',
    };
  }

  private get s3(): S3 {
    this.s3Instance ??= new S3(this.awsConfig);

    return this.s3Instance;
  }

  private get s3Client(): S3Client {
    this.s3ClientInstance ??= new S3Client(this.awsConfig);

    return this.s3ClientInstance;
  }

  async deleteImage(fileName: string) {
    if (this.provider === MEDIA_PROVIDER.CLOUDINARY) {
      const deleted = await this.cloudinary.delete(fileName);

      return SerializeHttpResponse(
        null,
        deleted ? HttpStatus.NO_CONTENT : HttpStatus.INTERNAL_SERVER_ERROR,
        deleted ? AWS_SUCCESS.DELETE_FILE : AWS_ERROR.DELETE_FILE,
      );
    }

    const params = { Bucket: this.bucketName, Key: fileName };

    try {
      await this.s3.deleteObject(params);
      return SerializeHttpResponse(
        null,
        HttpStatus.NO_CONTENT,
        AWS_SUCCESS.DELETE_FILE,
      );
    } catch (error) {
      return SerializeHttpResponse(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AWS_ERROR.DELETE_FILE,
      );
    }
  }

  /**
   * Uploads a file through whichever provider is configured.
   *
   * The return shape is identical for both, so no caller anywhere else in the
   * application knows or cares which one is in use.
   */
  async uploadFile(path: string, file: Express.Multer.File) {
    if (this.provider === MEDIA_PROVIDER.CLOUDINARY) {
      return this.cloudinary.upload(path, file);
    }

    const fileName = path;
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      const response = await new Upload({
        client: this.s3,
        params: { ...params, ACL: 'public-read' },
      }).done();

      return { name: fileName, url: response.Location };
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async uploadProfile(
    folderName: FOLDER_NAME,
    file: Express.Multer.File,
    fileName: string,
  ) {
    const path = `${folderName}/${fileName}`;
    return await this.uploadFile(path, file);
  }

  async uploadPhysiques(folderName: FOLDER_NAME, file: Express.Multer.File) {
    const path = `${folderName}/${file.originalname}`;
    return await this.uploadFile(path, file);
  }

  async generateUploadPresignedUrl(
    fileName: string,
    folderName?: FOLDER_NAME,
    contentType?: string,
  ) {
    const key = this.getObjectKey(fileName, folderName);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    });

    try {
      const url = await this.generateSignedUrl(command);
      return {
        fileName,
        key,
        url,
        expiresIn: this.expiresIn,
        method: 'PUT',
      };
    } catch (error) {
      console.error('Error generating upload presigned URL', error);
      throw new InternalServerErrorException('Unable to generate upload URL');
    }
  }

  async generateBulkUploadPresignedUrls(
    fileNames: string[],
    folderName?: FOLDER_NAME,
    contentType?: string,
  ) {
    return Promise.all(
      fileNames.map((fileName) =>
        this.generateUploadPresignedUrl(fileName, folderName, contentType),
      ),
    );
  }

  async generateGetPresignedUrl(fileName: string, folderName?: FOLDER_NAME) {
    const key = this.getObjectKey(fileName, folderName);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const url = await this.generateSignedUrl(command);
      return {
        fileName,
        key,
        url,
        expiresIn: this.expiresIn,
        method: 'GET',
      };
    } catch (error) {
      console.error('Error generating download presigned URL', error);
      throw new InternalServerErrorException('Unable to generate download URL');
    }
  }

  async deleteByFileName(fileName: string, folderName?: FOLDER_NAME) {
    const key = this.getObjectKey(fileName, folderName);
    return this.deleteImage(key);
  }

  async generateBulkGetPresignedUrls(
    fileNames: string[],
    folderName?: FOLDER_NAME,
  ) {
    return Promise.all(
      fileNames.map((fileName) =>
        this.generateGetPresignedUrl(fileName, folderName),
      ),
    );
  }

  async deleteManyByFileNames(fileNames: string[], folderName?: FOLDER_NAME) {
    return Promise.all(
      fileNames.map((fileName) => this.deleteByFileName(fileName, folderName)),
    );
  }

  private getObjectKey(fileName: string, folderName?: FOLDER_NAME) {
    return folderName ? `${folderName}/${fileName}` : fileName;
  }

  private async generateSignedUrl(
    command: PutObjectCommand | GetObjectCommand,
  ) {
    return await getSignedUrl(this.s3Client as unknown as any, command as any, {
      expiresIn: this.expiresIn,
    });
  }
}
