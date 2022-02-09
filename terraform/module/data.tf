resource "null_resource" "build_layer" {
  provisioner "local-exec" {
    command     = "${path.module}/scripts/build-layer.sh"
    interpreter = ["bash"]
  }
  triggers = {
    always_run = "${timestamp()}"
  }
}

data "archive_file" "layer" {
  type        = "zip"
  source_dir  = "../layer-sdk/src/"
  output_path = "../src/layer.zip"

  depends_on = [
    null_resource.build_layer
  ]
}

data "archive_file" "app" {
  type        = "zip"
  output_path = "../src/app.zip"
  source_dir  = "../lambda/"

  depends_on = [
    null_resource.build_layer
  ]
}

