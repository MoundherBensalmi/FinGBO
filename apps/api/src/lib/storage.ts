import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from '../env'

/** RustFS / MinIO need path-style URLs (http://host:9000/bucket/key). */
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
})

const Bucket = env.S3_BUCKET

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }))
}

/** The object's content as a web stream, or null if it doesn't exist. */
export async function getObject(key: string) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }))
    if (!res.Body) return null
    return { body: res.Body.transformToWebStream(), size: res.ContentLength }
  } catch (err) {
    if (err instanceof NoSuchKey) return null
    throw err
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }))
}

/** Logs a clear warning at startup when the bucket can't be reached. */
export async function checkStorage(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }))
    console.log(`Storage OK: bucket "${Bucket}" at ${env.S3_ENDPOINT}`)
  } catch (err) {
    console.warn(`Storage NOT reachable (bucket "${Bucket}" at ${env.S3_ENDPOINT}): attachments will fail.`, err)
  }
}
