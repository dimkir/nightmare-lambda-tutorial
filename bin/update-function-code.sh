#!/bin/bash

PROJECT_NAME=$(cat projectname.txt)

if [ "" == "$PROJECT_NAME" ]
then
  echo "Please specify in your project directory file projectname.txt with the name of the function"
  exit 1
fi

echo "Found project name [$PROJECT_NAME]"
aws lambda update-function-code  \
  --function-name $PROJECT_NAME \
  --zip-file fileb://./var/dist/$PROJECT_NAME.zip
