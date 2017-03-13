#!/bin/bash

echo "Number of parameters is $#"
if [ $# -ne 3 ]
then
    echo
    echo "---------------------------------------------"
    echo "Utility for creating lambda functions."
    echo "Creates a role for a particular function name, "
    echo "and adds policy to read from source bucket and write to target bucket."
    echo "----------------------------------------------"
    echo
    echo 
    echo "Usage: "
    echo "          ./$(basename $0) <function-name-or-alias> <source_bucket> <target_bucket>"
    echo
    echo
    exit 1
fi

function="$1"
source_bucket="$2"
target_bucket="$3"
echo "Lambda function alias: [$function], source bucket [$source_bucket], target bucket: [$target_bucket]"
# lambda_execution_role_name=$1



lambda_execution_role_name=lambda-$function-execution-role
lambda_execution_access_policy_name=lambda-$function-accesss-policy

lambda_execution_role_arn=$(aws iam create-role \
  --role-name "$lambda_execution_role_name" \
  --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "",
          "Effect": "Allow",
          "Principal": {
            "Service": "lambda.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }' \
  --output text \
  --query 'Role.Arn'
)
echo lambda_execution_role_arn=$lambda_execution_role_arn

aws iam put-role-policy \
  --role-name "$lambda_execution_role_name" \
  --policy-name "$lambda_execution_access_policy_name" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:*"
        ],
        "Resource": "arn:aws:logs:*:*:*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject"
        ],
        "Resource": "arn:aws:s3:::'$source_bucket'/*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:PutObject"
        ],
        "Resource": "arn:aws:s3:::'$target_bucket'/*"
      }
    ]
  }'

