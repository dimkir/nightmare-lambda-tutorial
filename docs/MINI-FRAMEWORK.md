How to use mini framework "Nightmare Tutorial" to develop run and test Nightmare scripts on Lambda
=====


In order to help you running NightmareJS o AWS Lambda we have created this package.

First clone the package into your home directory.


```
git clone http://github.com/dimkir/nightmare-lambda-tutorial.git 
cd nightmare-lambda-tutorial
```



#### Install and configure AWS CLI

Before we are able to create You have to have AWS CLI installed
```
sudo pip install awscli

aws configure

```

Make sure that you can execute under user credentials which have at least Admin Policy 
(because creating Lambda Function requires creating IAM role and only Admin Policy can do that).





#### Choose your function/project name

When your lambda function is published on AWS it should have a name. Please edit file `projectname.txt` and set 
the contents of the file to what you want your lambda called (remember to only use alphanumerical values and underscore). 
Or you can leave default name `nightmare-tutorial`.



#### Create your AWS Lambda function

There's a lot of ways to create lambda function: by clicking through AWS Web console, using AWS CLI or use the helper scripts from  `bin/` directory.

First let's call 

```
[nightmare-lambda-tutorial]$ bin/install/create-function.sh

```


You will get similar looking help output, which suggest that as a second parameter, 
we should use id (ARN) of the role under which lambda function will be executed. 

```
20:02 $ bin/install/create-function.sh 
Number of parameters is 0

  Usage:

   ./create-function.sh    <function-name-or-alias> <role-arn> <function-package.zip>

  Example: 

  ./create-function.sh    nightmare-tutorial    arn:xxxx     var/dist/nightmare-tutorial.zip

```


In order to get id (ARN) of the role, we first have to create this role.

Let's use another utility - `bin/install/create-role-with-policy.sh`:

```
✘-1 ~/l/nightmare-tutorial [master L|…14] 
20:02 $ bin/install/create-role-with-policy.sh 
Number of parameters is 0

---------------------------------------------
Utility for creating lambda functions.
Creates a role for a particular function name, 
and adds policy to read from source bucket and write to target bucket.
----------------------------------------------


Usage: 
          ./create-role-with-policy.sh <function-name-or-alias> <source_bucket> <target_bucket>




```


The source code from this tutorial will take a screenshot of a website using Nightmare and will save it to S3, 
this is why we need to specify buckets which lambda function will be able to read and write. 

So go ahead and create a bucket  (manually or via `aws s3 mb s3://my-fancy-bucket-777 --region eu-west-1`) and once 
the bucket is ready let's create a role:


```
bin/install/create-role-with-policy.sh nightmare-tutorial my-fancy-bucket-777 my-fancy-bucket-777
```

You will get output similar to this, what is important for us is arn of the role:
`arn:aws:iam::326625058526:role/lambda-nightmare-tutorial-execution-role`


```
✔ ~/l/nightmare-tutorial [master L|…14] 
20:12 $ bin/install/create-role-with-policy.sh nightmare-tutorial my-fancy-bucket-777 my-fancy-bucket-777
Number of parameters is 3
Lambda function alias: [nightmare-tutorial2], source bucket [my-fancy-bucket-777], target bucket: [my-fancy-bucket-777]
lambda_execution_role_arn=arn:aws:iam::326625058526:role/lambda-nightmare-tutorial-execution-role

```



Before we make a function, we have create a zip package. In simple words we will include the source files 
and most of dependencies from `node_modules` folder. For running on Lambda we will not need `electron/dist` folder
and it will be excluded from the archive. For more details on how package is zipped see `bin/zip-package.sh`. 

```
bin/zip-package.zip 
```

You will see the list of files added to the package and total size of the zip. In my case it is ~1Mb. 
The zip-will be stored in the folder `var/dist`.

```
  adding: .....
  adding: .....
  adding: .....
  adding: .....
  adding: .....

-rw-rw-r-- 1 mars mars 1.1M Mar 13 20:21 var/dist/nightmare-tutorial.zip

```


Now, as we finally have role ID (ARN) and zipped function source, we can finally create our function. We choose `nodejs4.3` runtime
and create function with 1024Mb of Memory (they work and boot up faster and it is rarely worth using lambdas with less memory).

```
[nightmare-lambda-tutorial]$ bin/install/create-function.sh nightmare-tutorial \
             arn:aws:iam::326625058526:role/lambda-nightmare-tutorial-execution-role \
             var/dist/nightmare-tutorial.zip
```


```
✔ ~/l/nightmare-tutorial [master L|…14] 
20:24 $ bin/install/create-function.sh nightmare-tutorial arn:aws:iam::326625058526:role/lambda-nightmare-tutorial-execution-role var/dist/nightmare-tutorial.zip 
Number of parameters is 3
Function alias:\t     nightmare-tutorial
Role ARN: \t          arn:aws:iam::326625058526:role/lambda-nightmare-tutorial2-execution-role 
Function package:\t   var/dist/nightmare-tutorial.zip
{
    "CodeSha256": "QedKlzWH0A9jPumkuuyleINFDNdqkqANy9hA2ysjoUA=", 
    "FunctionName": "nightmare-tutorial", 
    "CodeSize": 1062573, 
    "MemorySize": 1024, 
    "FunctionArn": "arn:aws:lambda:eu-west-1:326625058526:function:nightmare-tutorial", 
    "Version": "$LATEST", 
    "Role": "arn:aws:iam::326625058526:role/lambda-nightmare-tutorial-execution-role", 
    "Timeout": 3, 
    "LastModified": "2017-03-13T20:24:43.112+0000", 
    "Handler": "index.handler", 
    "Runtime": "nodejs4.3", 
    "Description": ""
}


```



#### Run your lambda function

Now you can invoke your lambda function either by calling `bin/run.sh http://www.yahoo.com`. 
If you have configured everything correctly, you will see similar output.

```
20:24 $ bin/run.sh http://www.yahoo.com
{
    "StatusCode": 200
}
Returned with retval [0]
"http://s3-eu-west-1.amazonaws.com/my-fancy-bucket-777/test/store/image-1489436927266.png"
JQ returned 0
✔ ~/l/nightmare-tutorial [master L|…14] 

```





or if you prefer to invoke the lambda manually, you can do that via AWS CLI. Note that last parameter
is the name of the log file (no need for output redirects like `>`!). And to see the result you would have to `cat var/log/logfile.txt`

```
aws lambda invoke-function \
   --function-name nightmare-tutorial \
   --payload '{ "url" : "http://www.yahoo.com" }' \
   var/log/logfile.txt

```







#### Let's review the magic which allows nightmare to run 

In the very header of `index.js` you can find the following code,
which takes care of pulling and installing all required native dependencies:


```
/***********************************************************
 * This magic code runs once per boot-up of lambda container
 * and pulls all the electron and Xvfb binaries and stores 
 * them in /tmp/pck folder. 
 * 
 * Later on business logic should be called within xvfb.start()
 * callback, so that when Nightmare calls Electron there is
 * a virtual framebuffer available.
 * 
 * Variable electronPath starts as undefined and is only 
 * overridden on Lambda environment. Which simplifies testing
 * lambda in local environment.
 * 
 ***********************************************************/
console.log('Lambda executes global code upon container boot-up');

var electronPath, pack, isOnLambda, Xvfb;

pack       = require('./lib/bootstrap/nightmare-lambda-pack');
isOnLambda = pack.isOnLambda;
Xvfb       = require('./lib/bootstrap/xvfb');
if ( isOnLambda ){
    electronPath = pack.installNightmare(); 
}


/** ************************************************************** */


```


Also business logic is running within callback to `xvfb.start()` 
which allows to start using Nightmare/Electron only when virtual framebuffer is available.




