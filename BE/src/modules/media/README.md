# Media Module - API Usage

## Endpoints

### Generate Presigned Upload URL (Single)

```http
POST /mediabucket/presign-upload
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileName": "image.jpg",
  "folderName": "PROFILE",
  "contentType": "image/jpeg"
}
```

**Response:**

```json
{
  "url": "https://s3.amazonaws.com/...",
  "fileName": "image.jpg",
  "expiresIn": 3600
}
```

### Generate Presigned Upload URLs (Bulk)

```http
POST /mediabucket/presign-upload/bulk
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileNames": ["image1.jpg", "image2.jpg", "image3.jpg"],
  "folderName": "PROFILE",
  "contentType": "image/jpeg"
}
```

**Response:**

```json
{
  "urls": [
    {
      "url": "https://s3.amazonaws.com/...",
      "fileName": "image1.jpg"
    }
  ]
}
```

### Generate Presigned Download URL (Single)

```http
POST /mediabucket/presign-download
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileName": "image.jpg",
  "folderName": "PROFILE"
}
```

**Response:**

```json
{
  "url": "https://s3.amazonaws.com/...",
  "fileName": "image.jpg",
  "expiresIn": 3600
}
```

### Generate Presigned Download URLs (Bulk)

```http
POST /mediabucket/presign-download/bulk
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileNames": ["image1.jpg", "image2.jpg", "image3.jpg"]
}
```

**Response:**

```json
{
  "urls": [
    {
      "url": "https://s3.amazonaws.com/...",
      "fileName": "image1.jpg"
    }
  ]
}
```

### Delete File

```http
DELETE /mediabucket
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileName": "image.jpg",
  "folderName": "PROFILE"
}
```

**Response:**

```json
{
  "message": "File deleted successfully"
}
```

### Delete Files (Bulk)

```http
DELETE /mediabucket/bulk
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileNames": ["image1.jpg", "image2.jpg", "image3.jpg"]
}
```

**Response:**

```json
{
  "message": "Files deleted successfully",
  "deletedCount": 3
}
```
