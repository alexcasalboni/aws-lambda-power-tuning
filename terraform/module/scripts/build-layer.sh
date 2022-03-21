#!/bin/bash

# make sure we're working on the layer folder
cd ../layer-sdk

# create subfolders
## ./src is referenced by the LayerVersion resource (.gitignored)
## ./src/nodejs will contain the node_modules
mkdir -p ./src/nodejs

# install layer dependencies (the SDK)
npm i

# clean up previous build ...
rm -rf ./src/nodejs/node_modules

# ... and move everything into the layer sub-folder
mv ./node_modules ./src/nodejs