data "archive_file" "app" {
  type        = "zip"
  output_path = "../src/app.zip"
  source_dir  = "../lambda/"
}
