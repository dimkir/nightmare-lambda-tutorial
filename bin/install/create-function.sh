#!/bin/bash

# get project name from file
PROJECT_NAME=$(cat projectname.txt)

if [ "" == "$PROJECT_NAME" ]
then
  # Fallback to using project directory name as project name
  PROJECT_DIR_RELATIVE=$(dirname $(dirname $(dirname $0)))
  pushd . > /dev/null
  PROJECT_NAME=$(basename $(cd $PROJECT_DIR_RELATIVE && pwd))
  popd > /dev/null
fi



echo "Number of parameters is $#"
if [ $# -ne 3 ]
then
    CMD="./$(basename $0)"
    echo
    echo "  Usage:"
    echo
    echo "   $CMD    <function-name-or-alias> <role-arn> <function-package.zip>"
    echo
    echo "  Example: "
    echo
    echo "  $CMD    $PROJECT_NAME    arn:xxxx     var/dist/$PROJECT_NAME.zip"
    echo
    echo

    exit 1
fi

function=$1
role_arn=$2
package=$3
echo "Function alias:\t     $function"
echo "Role ARN: \t          $role_arn "
echo "Function package:\t   $package"


aws lambda create-function \
    --function $function \
    --memory-size 1024 \
    --timeout 60 \
    --runtime nodejs4.3 \
    --handler index.handler \
    --role $role_arn \
    --zip-file fileb://./$package
