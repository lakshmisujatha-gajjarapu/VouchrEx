output "bucket_name" {
  description = "Lightsail bucket name"
  value       = aws_lightsail_bucket.store.name
}

output "bucket_url" {
  description = "S3-compatible endpoint URL for the bucket (use as MINIO_ENDPOINT)"
  value       = "https://s3.${var.aws_region}.amazonaws.com"
}

output "access_key_id" {
  description = "Access key ID for the bucket (use as MINIO_ACCESS_KEY)"
  value       = aws_lightsail_bucket_access_key.store.access_key_id
  sensitive   = true
}

output "secret_access_key" {
  description = "Secret access key for the bucket (use as MINIO_SECRET_KEY)"
  value       = aws_lightsail_bucket_access_key.store.secret_access_key
  sensitive   = true
}
