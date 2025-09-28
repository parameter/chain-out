// backend/utils/s3.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

let s3Client;

function getS3Client() {
  if (s3Client) return s3Client;

  const region = process.env.S3_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || undefined; // e.g. https://s3.wasabisys.com
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle, // set true for MinIO/DO Spaces if needed
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || ''
    }
  });

  return s3Client;
}

function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is not set');
  return bucket;
}

function getPublicUrl(key) {
  // If you serve files via CDN or static endpoint, set S3_PUBLIC_BASE_URL (e.g. https://my-bucket.s3.amazonaws.com or CDN)
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) {
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/${encodeURI(key)}`;
  }
  // Construct a generic virtual-hosted style URL if endpoint is Amazon S3 and forcePathStyle is not required
  const bucket = getBucket();
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';

  if (!endpoint) {
    // default AWS S3 domain
    return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
  }

  // If a custom endpoint is used and you’re not forcing path style, attempt virtual hosted URL
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';
  if (!forcePathStyle) {
    const u = new URL(endpoint);
    return `${u.protocol}//${bucket}.${u.host}/${encodeURI(key)}`;
  }

  // Fallback to path-style URL
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}/${bucket}/${encodeURI(key)}`;
}

async function uploadBuffer(key, buffer, contentType = 'application/octet-stream', acl = undefined, extra = {}) {
  const client = getS3Client();
  const bucket = getBucket();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: acl, // e.g. 'public-read' (not supported on some providers)
    ...extra
  });

  await client.send(cmd);
  return {
    key,
    url: getPublicUrl(key)
  };
}

async function uploadFileFromPath(key, filePath, contentType = undefined, acl = undefined, extra = {}) {
  const buffer = await fs.promises.readFile(filePath);
  return uploadBuffer(key, buffer, contentType || guessContentType(filePath), acl, extra);
}

function guessContentType(filePath) {
  // Minimal heuristic; you can integrate 'mime-types' if desired
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt') return 'text/plain';
  return 'application/octet-stream';
}

async function getPresignedPutUrl(key, contentType = 'application/octet-stream', expiresSeconds = 900) {
  const client = getS3Client();
  const bucket = getBucket();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });

  const url = await getSignedUrl(client, cmd, { expiresIn: expiresSeconds });
  return { key, url };
}

async function getPresignedGetUrl(key, expiresSeconds = 900) {
  const client = getS3Client();
  const bucket = getBucket();

  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const url = await getSignedUrl(client, cmd, { expiresIn: expiresSeconds });
  return { key, url };
}

async function deleteObject(key) {
  const client = getS3Client();
  const bucket = getBucket();

  const cmd = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  });
  await client.send(cmd);
  return { key, deleted: true };
}

module.exports = {
  getS3Client,
  uploadBuffer,
  uploadFileFromPath,
  getPresignedPutUrl,
  getPresignedGetUrl,
  deleteObject,
  getPublicUrl
};