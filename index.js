'use strict';


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

var electronPath, binaryPack, isOnLambda, Xvfb;

binaryPack = require('./lib/bootstrap/nightmare-lambda-pack');
isOnLambda = binaryPack.isOnLambda;
Xvfb       = require('./lib/bootstrap/xvfb');
if ( isOnLambda ){
    electronPath = binaryPack.installNightmare(); 
}


/** ************************************************************** */


var Snapper    = require('./lib/nightmare-snapper');
var DEFAULT_BUCKET_NAME   = 'my-fancy-bucket-777';
var DEFAULT_BUCKET_REGION = 'eu-west-1';


exports.handler = function(event, context){
    
    // how do I know that by the time this was run, the pack was installed? 
    var url, xvfb, snapper;
    
    if ( !event.url ){
        context.done('Error please specify .url property on the event');
        return;
    }
    
    url = event.url;

    console.log(binaryPack._df()); // let's log `df -h` current disk usage

    xvfb = new Xvfb({
        xvfb_executable : '/tmp/pck/Xvfb' // path to Xvfb deployed from nightmare-lambda-pack
    })

    xvfb.start((err, xvfbProcess) => {

        if (err){
            console.error('Error starting xvfb', err);
            return context.done(err);
        }

        snapper = new Snapper({
            destBucket: DEFAULT_BUCKET_NAME, 
            destBucketRegion: DEFAULT_BUCKET_REGION, // this is used to generate full screenshot url in form http://s3-region.amazonaws.com/key/screenshot-xxxx.png,
            nightmareOptions: {
                electronPath: electronPath
            }
        });
        
        console.log(`Initialized snapper with electronPath ${electronPath}`);


        snapper.snap({ url: url })
            .then((result) => {
                console.log(result);
                stopXvfbAndFinish(null, result);
            }
            , (err) => {
                console.error(err);
                stopXvfbAndFinish(err);
            });



        function stopXvfbAndFinish(err, result){
            // do we have to wait? or will it be terminated automatically by lambda runtime (remember defunct processes?)?
            // will it be killed when context.done() is called?
            // xvfb.stop();
            xvfb.stop((err) => {
                context.done(err, result);
            }); 
        }


    });
    

    
    
}