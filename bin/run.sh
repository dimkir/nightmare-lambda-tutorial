#!/bin/bash
#set -x

PROJECT_NAME=$(cat projectname.txt)
if [ "" == "$PROJECT_NAME" ]
then
  echo "Please specify in your project directory file projectname.txt with the name of the function"
  exit 1
fi

if [ "$#" -ne "1" ]; then
 echo
 echo "Usage: "
 echo 
 echo "   $(basename $0) <http(s)-website-url>"
 echo
 exit 1
fi

URL=$1

LOG_FILE="var/log/log-$(date +"%Y%m%d------%H-%M--%S").json"

aws lambda invoke \
    --function-name $PROJECT_NAME \
    --payload "{ \"url\" : \"$URL\" }" \
    $LOG_FILE 

RETVAL=$?

echo "Returned with retval [$RETVAL]"

cat $LOG_FILE | jq .web && echo "JQ returned $?"
