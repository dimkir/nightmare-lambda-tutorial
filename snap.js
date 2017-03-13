
/// snap.js 
var Snapper = require('./lib/nightmare-snapper');



if (process.argv.length < 3 ){
    console.error('Usage:');
    console.error('   snap.js <http(s)-website-url>');
    process.exit(1);
}
else{
    var  url = process.argv[2];
}



var snapper = new Snapper({
    destBucket: 'rojet', 
    destBucketRegion: 'eu-west-1', // this is used to generate full screenshot url in form http://s3-region.amazonaws.com/key/screenshot-xxxx.png
});




snapper.snap({ url: url })
    .then((result) => {
        console.log(result);
    }
    , (err) => {
        console.error(err);
    });

