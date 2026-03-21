resource "aws_lightsail_bucket" "store" {
  name      = var.bucket_name
  bundle_id = "small_1_0" # 100 GB storage, $1/mo

  tags = {
    Project = "couponbazaar"
  }
}

resource "aws_lightsail_bucket_access_key" "store" {
  bucket_name = aws_lightsail_bucket.store.name
}
