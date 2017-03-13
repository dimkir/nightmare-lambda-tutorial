'use strict';

var log = require('debug')('nightmare-snapper:log');
var debug = require('debug')('nightmare-snapper');

const AWS = require('aws-sdk');
const Nightmare = require('nightmare');
const fs = require('fs');
const s3 = new AWS.S3();




const DEFAULT_IMAGE_DEST_DIR = '/tmp';
const DEFAULT_GENERATE_NEXT_IMAGE_FILENAME = function () {
    return `image-${(new Date()).getTime()}.png`
};
const DEFAULT_IMAGE_CONTENT_TYPE = 'image/png';


/**
 * @options {Object}
 * @options.nightmareOptions {Object}
 */
function NightmareSnapper(options) {

    options = options || {};


    options.imageDestDir              = options.imageDestDir              || DEFAULT_IMAGE_DEST_DIR;
    options.generateNextImageFilename = options.generateNextImageFilename || DEFAULT_GENERATE_NEXT_IMAGE_FILENAME;
    options.imageContentType          = options.imageContentType          || DEFAULT_IMAGE_CONTENT_TYPE;
    
    options.destBucket                = options.destBucket                || undefined;  // eg 'your-bucket-name'
    options.destBucketRegion          = options.destBucketRegion          || undefined;  // eg. 'eu-west-1'      

    this.options = options;
    this.nightmare = new Nightmare(options.nightmareOptions);

}

module.exports = NightmareSnapper;


var _p = NightmareSnapper.prototype;


/**
 * Makes screenshot and stores it in local temp folder
 * opts.url : url of the site
 * @return promise<StringLocalFilename>
 */
_p.snapWebsiteToLocalFile = function (opts) {
    var deferred = Promise.defer();
    var that = this;

    var imagePathname = that.options.imageDestDir + '/' + that.options.generateNextImageFilename();

    this.nightmare
        .goto(opts.url)
        .screenshot(imagePathname)
        .end()
        .then(function (result) {
            deferred.resolve(imagePathname);
        })
        .catch(function (e) {
            deferred.reject(e);
        });

    return deferred.promise;
};

/**
 * Stores file on S3
 * @localFile {String}
 * @opt {Object}
 * @opt.bucket {String}
 * @opt.bucketRegion {String}
 * @opt.key {String}
 * 
 */
_p.storeScreenshot = function (localFile, opt) {

    var that = this;
    var deferred = Promise.defer();

    var stream = fs.createReadStream(localFile);
    stream.on('error', function (err) {
        deferred.reject(err);
    });

    stream.on('open', function () {

        // promise
        s3.putObject({
            Bucket: opt.bucket,
            Key: opt.key,
            Body: stream,
            ContentType: that.options.imageContentType
        }, function (err, res) {
            // next
            if (err) {
                deferred.reject(err);
                return;
            }
            debug(res);

            deferred.resolve({
                message: `Successfully stored local screenshot [${localFile}] on S3.'`,
                uri: `s3://${opt.bucket}/${opt.key}`,
                web: `http://s3-${opt.bucketRegion}.amazonaws.com/${opt.bucket}/${opt.key}`
            });
        });


    });
    return deferred.promise;
};

/**
 * @opts {Object}
 * @opts.url [REQUIRED]
 * @opts.destBucket
 * @opts.destBucketRegion
 * @opts.destKey 
 */
_p.snap = function (opts) {
    var that = this;

    return that.snapWebsiteToLocalFile({
        url: opts.url
    })
        .then(function (localImageFile) {

            return that.storeScreenshot(localImageFile, {
                bucket       : opts.destBucket       || that.options.destBucket,
                bucketRegion : opts.destBucketRegion || that.options.destBucketRegion,
                key          : opts.destKey          || 'test/store/' + that.options.generateNextImageFilename(), // this is different filename vs local filename?
            });
        });
}
