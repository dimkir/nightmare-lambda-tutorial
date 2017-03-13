#!/bin/bash

PROJECT_NAME=$(cat projectname.txt)
if [ "" == "$PROJECT_NAME" ]
then
  echo "Please specify in your project directory file projectname.txt with the name of the function"
  exit 1
fi

package_file=var/dist/$PROJECT_NAME.zip
DIRNAME=$(dirname $package_file)
[ -d $DIRNAME ] || mkdir -p $DIRNAME
rm $package_file
[ -f package-list.txt.sh ] && cat package-list.txt.sh | grep -v ^# | zip -j -@ $package_file
zip    $package_file index.js
zip -r $package_file lib
#zip -r $package_file modules/xvfb/xkb  # no need as this is part of package
zip -r $package_file node_modules \
   -x '*node_modules/nightmare/node_modules/electron/dist*'  \
   -x '*node_modules/nightmare/node_modules/electron/node_modules/electron-download*' \
   -x '*node_modules/aws-sdk*'
#zip -r $package_file elapps/ipc-demo -x '*node_modules*' -x '*.git*'
ls -lah $package_file
# unzip -l $package_file
