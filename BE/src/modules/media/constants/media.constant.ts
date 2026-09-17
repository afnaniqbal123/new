export enum FOLDER_NAME {
  PROFILE = 'profile',
  WORKSPACE = 'workspace',
  WORKSPACE_BASE = 'workspace-base',
  ICONS = 'icons',
  EMAIL_ASSETS = 'email-assets',
}

/**
 * Where uploaded files are stored.
 *
 * Both are fully implemented for upload and delete. Cloudinary is listed
 * first because its free tier is what makes this product deployable at zero
 * cost; S3 is the default only because it was already wired. CONTEXT.md D11.
 */
export enum MEDIA_PROVIDER {
  CLOUDINARY = 'cloudinary',
  S3 = 's3',
}
