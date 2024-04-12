resource "null_resource" "build_layer" {
  provisioner "local-exec" {
    command     = "./build-layer.sh"
    interpreter = ["bash"]
    working_dir = "${path.module}/scripts/"
  }
  triggers = {
    always_run = timestamp()
  }
}

data "archive_file" "layer" {
  type        = "zip"
  source_dir  = "${path.module}/../../layer-sdk/src/"
  output_path = "../src/layer.zip"

  depends_on = [
    null_resource.build_layer
  ]
}

data "archive_file" "app" {
  type        = "zip"
  output_path = "../src/app.zip"
  source_dir  = "${path.module}/../../lambda/"

  depends_on = [
    null_resource.build_layer
  ]
}
