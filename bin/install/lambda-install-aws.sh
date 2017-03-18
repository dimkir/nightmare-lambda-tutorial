#!/bin/bash +x

#############
#  Settings
#############

FUNCTION=nightmare-tut-hello
REGION=eu-west-1
DEPLOYMENT_PACKAGE_ZIP=nightmare-tutorial-function.zip



#############
#    Main
#############

# Global Variables
CMD=$(basename $0)


# -----------------------
# Test for prerequesites
# -----------------------


 # Test for having AWS CLI installed and available on PATH
 type -P aws >/dev/null
 if [ $? -ne 0 ]; then
   echo "Cannot find `aws` executable on PATH. Are you sure AWS CLI is installed and configured correctly."
   echo "You can install AWS CLI via `pip install awscli` "
   echo "or read more at http://docs.aws.amazon.com/cli/latest/userguide/installing.html"
   exit 1
 fi

 # Test for credentials 
   # actual execution of commands should give clear indications of which credentials need to be fixed


 # Test for zip file
 if [ ! -f "$DEPLOYMENT_PACKAGE_ZIP" ]; then
    echo "Cannot find deployment package zip file with name: [$DEPLOYMENT_PACKAGE_ZIP]"
    echo "Please edit ## Settings ## section of the $CMD script"
    exit 1
 fi


# -------------
#  Create Role
# -------------
# This compact way of creating roles was inspired by https://alestic.com/2014/11/aws-lambda-cli/ article.

echo ">>> Creating execution role ..."
LAMBDA_EXECUTION_ROLE_NAME=$FUNCTION"-lambda-execution-role"
LAMBDA_EXECUTION_ROLE_ARN=$(aws iam create-role \
  --role-name $LAMBDA_EXECUTION_ROLE_NAME \
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
RETVAL=$?
if [ "0" -ne "$RETVAL" ]; then
  echo "Error excuting AWS CLI. ERROR CODE: $RETVAL"
  echo "Aborting."
  exit 2
fi

echo "    Execution role name: [$LAMBDA_EXECUTION_ROLE_NAME]"
echo "    Execution role arn: [$LAMBDA_EXECUTION_ROLE_ARN]"


# ---------------
#  Create Policy
# ---------------
echo ">>> Creating execution policy..."

LAMBDA_EXECUTION_ACCESS_POLICY_NAME=$FUNCTION"-lambda-execution-access-policy"
aws iam put-role-policy \
  --role-name $LAMBDA_EXECUTION_ROLE_NAME \
  --policy-name $LAMBDA_EXECUTION_ACCESS_POLICY_NAME \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:*"
        ],
        "Resource": "arn:aws:logs:*:*:*"
      }
    ]
  }'
RETVAL=$?
if [ "0" -ne "$RETVAL" ]; then
  echo "Error excuting AWS CLI. ERROR CODE: $RETVAL"
  echo "Aborting."
  exit 2
fi


# ---------------
# Create function
# ---------------

echo ">>> Creating lambda function..."

aws lambda create-function \
    --function $FUNCTION \
    --memory-size 1024 \
    --timeout 60 \
    --runtime nodejs4.3 \
    --handler index.handler \
    --role $LAMBDA_EXECUTION_ROLE_ARN \
    --zip-file fileb://./$DEPLOYMENT_PACKAGE_ZIP
RETVAL=$?
if [ "0" -ne "$RETVAL" ]; then
  echo "Error excuting AWS CLI. ERROR CODE: $RETVAL"
  exit 2
fi
    