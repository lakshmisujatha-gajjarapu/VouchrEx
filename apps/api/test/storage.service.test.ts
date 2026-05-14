import test from 'node:test';
import assert from 'node:assert/strict';

test('StorageService.uploadFile calls PutObjectCommand with correct params', async () => {
  process.env.STORAGE_ACCESS_KEY = 'test-key';
  process.env.STORAGE_SECRET_KEY = 'test-secret';

  let sentCommand: unknown;

  const { StorageService } = require('../src/modules/storage/storage.service');
  const svc: InstanceType<typeof StorageService> = new StorageService();

  // Patch the internal S3 client's send method
  (svc as any).s3 = {
    send: async (cmd: unknown) => {
      sentCommand = cmd;
    },
  };
  (svc as any).bucket = 'test-bucket';

  await svc.uploadFile('my/key.jpg', Buffer.from('data'), 'image/jpeg');

  assert.ok(sentCommand, 'send was called');
  const input = (sentCommand as any).input;
  assert.equal(input.Bucket, 'test-bucket');
  assert.equal(input.Key, 'my/key.jpg');
  assert.equal(input.ContentType, 'image/jpeg');
});

test('StorageService.getSignedUrl returns a string URL', async () => {
  process.env.STORAGE_ACCESS_KEY = 'test-key';
  process.env.STORAGE_SECRET_KEY = 'test-secret';

  // The presigner builds a signed URL locally without making network calls,
  // so we can use the real S3Client with fake credentials.
  const { StorageService } = require('../src/modules/storage/storage.service');
  const svc: InstanceType<typeof StorageService> = new StorageService();
  (svc as any).bucket = 'test-bucket';

  const url = await svc.getSignedUrl('my/key.jpg', 900);
  assert.equal(typeof url, 'string');
  assert.ok(url.startsWith('https://'));
  assert.ok(url.includes('my/key.jpg'));
  assert.ok(url.includes('X-Amz-Expires=900'));
});
