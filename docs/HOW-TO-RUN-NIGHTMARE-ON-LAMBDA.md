You probably already run Nightmare on your dev machine or on some kind of build or test server (like AWS EC2). 
But now, you are reading this guide because you have decide to avoid all the hassle of maintaining servers
and run Nightmare on AWS Lambda serverlessly.

Lambda is amazing, but this awesomeness comes at cost of few restrictions and limitations. 
Thus setting up Nightmare "the usual way"  via `npm install nightmare` and uploading it to Lambda *won't work*.
In this tutorial we outline the recipe to go around those Lambda limitations and give some technical insights which
will help you develop intuition for running Nightmare on Lambda.



## The vanilla approach which won't work on Lambda

You would typically start writing source for your lambda function on local development machine following those steps:
 
 1. Install Nightmare `npm install nightmare` 
 2. Create `index.js` (source below)
 3. Create dummy event file to test lambda `echo {} > event.json` 
 4. Run `lambda-local -l index.js  -e event.json --timeout 30`  

> To run lambda on local machine with ease, we will use  [lambda-local](https://www.npmjs.com/package/lambda-local)
> command line utility which you can install on your dev machine via  `npm install -g lambda-local`. 


```

// index.js 
var Nightmare = require('nightmare');       
var nightmare = Nightmare({ show: true });

exports.handler = function(event, context){

    nightmare
    .goto('https://duckduckgo.com')
    .type('#search_form_input_homepage', 'github nightmare')
    .click('#search_button_homepage')
    .wait('#zero_click_wrapper .c-info__title a')
    .evaluate(function () {
        return document.querySelector('#zero_click_wrapper .c-info__title a').href;
    })
    .end()
    .then(function (result) {
        console.log(result);
        context.done(null, result); 
    })
    .catch(function (error) {
        console.error('Search failed:', error);
        context.done(error);
    });

}
  
```


#### Problem with missing Electron dependencies
Although this approach seems trivial, there's a bit of magic involved. 
In particular `npm install` will _not_ only install JavaScript sources for the dependencies, 
but also binary dependencies. And because Nightmare relies heavily on [Electron](http://electron.atom.io) under the hood, 
the binary executable `electron` will be installed into your projects subfolder 
`node_modules/nightmare/node_modules/electron/dist`.  The `dist` folder will have few more supporting binaries including localization files and libs.

On your typical desktop distribution of Linux everything is going to work well. On most server distributions 
you will hit missing shared libraries error, which you can solve by following 
[instructions on solving Common Execution Problems](https://github.com/segmentio/nightmare#common-execution-problems). 
However given solution would require root access, which you do _not_ have on Lambda.


So Electron requires:
  - a ton of static libraries which are not installed on Lambda (eg. libgtk+)
  - electron requires a real display or fake display framebuffer (eg. `Xvfb` ) to run successfully

The solution was to [pick and compile](https://gist.github.com/dimkir/f4afde77366ff041b66d2252b45a13db) libraries manually 
and deliver them to Lambda for execution.

#### Lambda has limit to zip-package size
When we first bundled all the missing libraries into a zip-file to upload to Lambda, it turned out `58 Mb` 
whilst [Lambda has limit](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) of `50 Mb` maximum for function zip-file.


The solution was simple - package all the required binaries into a zip file and make it available on S3 in the region where your
function runs. Your lambda function should pull the binary package to `/tmp` directory before each execution and unzip it.
 
This is why in the head of your lambda function you would use: 

```
var binaryPack = require('./lib/bootstrap/nightmare-lambda-pack');

binaryPack.installNightmareOnLambdaEnvironment();

exports.handler = function(event, context){
    ...
}

```

which would take care of pulling binary package from S3 into running Lambda container before execution of your event handler.

Here you can find packages for your region:

 - Hosted on `eu-west-1` [nightmare-lambda-pck-with-xvfb-20170313-1726-43.zip](http://static.apptentic.com/tools/electron/nightmare-lambda-pck-with-xvfb-20170313-1726-43.zip) (58 Mb)
 - Hosted on `us-west-1` TBD


#### But Nightmare requires display buffer (at least virtual) which Lambda does not have!

Usually virtual framebuffer is added on headless machines via running `Xvfb` before running actual program which 
requires display via `xvfb-run.sh` or as a background daemon. However for Lambda we will use [xvfb package](https://www.npmjs.com/package/xvfb)
to run `Xvfb` before we run Nightmare and to cleanly close `Xvfb` after we have finished execution.

```
var Xvfb = require('./lib/bootstrap/xvfb');

...

exports.handler = function(event, context){


var xvfb = new Xvfb({ xvfb_executable: '/tmp/pck/Xvfb' }); // this is location of Xvfb executable, after binary pack unzipped

 xvfb.start((err, xvfbProcess) => {
     
     if (err) context.done(err);

     function done(err, result){
        xvfb.stop((err) => context.done(err, result)); 
     }

     // ... 
     // Here goes the logic of your actual lambda function
     // note that you must call done() instead of context.done() to close Xvfb correctly.
     // ...


 });

}

...


```





## TL;DR;




#### Install packages
```
npm install nightmare nightmare-lambda-pack
```


#### Write your lambda function source code

When writing your lambda logic, you will have to add binary pack installation line outside of the event handler
and wrap actual logic within  in xvfb.start() callback (and remember to call xvfb.stop()). 

After you've completed those steps your source would look like this:

```
var binaryPack = require('./lib/bootstrap/nightmare-lambda-pack');
var Nightmare = require('nightmare');

binaryPack.installNightmareOnLambdaEnvironment();

exports.handler = function(event, context){


var xvfb = new Xvfb({ xvfb_executable: '/tmp/pck/Xvfb' }); // this is location of Xvfb executable, after binary pack unzipped

 xvfb.start((err, xvfbProcess) => {
     
     if (err) context.done(err);

     function done(err, result){
        xvfb.stop((err) => context.done(err, result)); 
     }

     var nightmare = Nightmare({ show: true });
     

     // ... 
     // Here goes the logic of your actual lambda function
     // note that you must call done() instead of context.done() to close Xvfb correctly.
     // ...
     nightmare
        .goto('https://duckduckgo.com')
        .type('#search_form_input_homepage', 'github nightmare')
        .click('#search_button_homepage')
        .wait('#zero_click_wrapper .c-info__title a')
        .evaluate(function () {
            return document.querySelector('#zero_click_wrapper .c-info__title a').href;
        })
        .end()
        .then(function (result) {
            console.log(result);
            done(null, result);  // done() instead of context.done()
        })
        .catch(function (error) {
            console.error('Search failed:', error);
            done(error); // done() instead of context.done()
        });     


 });

}


```




#### Create lambda function zip-package


Usually for simplicity sake you would create zip file in the following manner
```
zip -r nightmare-tutorial-function.zip index.js lib node_modules
```

However this will include distribution of Electron which is only good to run on your local machine. So on Lambda we do not 
need it. This is why we can exclude `node_modules/nightmare/node_modules/electron/dist` folder:

```
zip -r nightmare-tutorial-function.zip index.js lib node_modules \
   -x '*node_modules/nightmare/node_modules/electron/dist*'
```

or you can get by with a shorter version


```
zip -r nightmare-tutorial-function.zip index.js lib node_modules \
   -x '*electron/dist*' 
```


#### Create your Lambda function on AWS 

Now as you have zip-file with your lambda source, you are ready to 
create lambda function on AWS. 

We are going to create function with the following parameters:

  - Runtime `node4.3`
  - Memory size `1GB` (Selecting `1GB` of memory would automatically match up with faster instance which will unzip binary package in a jiffy)


There are  many ways you can create lambda function on AWS
  - AWS web console (you can do it yourself)
  - AWS CLI
  - Cloud Formation


We to quickly follow through through this tutorial we recommend to actually use this quick Cloud Formation based script.
For both approaches you will need to [install AWS CLI and obtain credentials](docs/INSTALL-AWS-CLI.md)

```
 TBD 
 ./create-lambda-aws
 ./delete-lambda-aws # to delete function
```


However for more in-depth work with lambda functions in this tutorial we have created 
[Tools and Instructions how to create and update lambda functions using pure AWS CLI](docs/CREATE-LAMBDA-FUNCTION-USING-AWS-CLI.md)


#### Invoke your lambda function

```
aws lambda invoke --function-name nightmare-tutorial --payload {} result.log
```




