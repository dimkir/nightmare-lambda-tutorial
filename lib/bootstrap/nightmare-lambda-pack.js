/**
 * This package allows using Nightmare with Electron on AWS Lambda.
 *
 * Package was inspired by the approach taken by:
 * https://github.com/justengland/phantomjs-lambda-pack/
 *
 *
 * https://github.com/justengland/phantomjs-lambda-pack/blob/master/index.js
 */

// var debug = require('debug')('nightmare-lambda-pack');
var child_process = require('child_process');

var pack = exports = module.exports = {};


var SECOND = 1000; // millis

var config = {
    tmpdir: '/tmp',
    // defaultElectronPackageUrl: 'http://static.apptentic.com/tools/electron/electron-full-amzn-linux-20170309-1619-47.zip',
    defaultElectronPackageUrl: 'http://static.apptentic.com/tools/electron/nightmare-lambda-pck-with-xvfb-20170313-1726-43.zip',
    zipPath: 'pck/electron.patch.devshm' // path to electron executable within the path
};




pack.isRunningOnLambdaEnvironment = Boolean(process.env['AWS_LAMBDA_FUNCTION_NAME']);

/**
* Downloads file to temp dir
* @return full path to downloaded file
*/
pack._downloadFileSync = function (url, destFilename) {
    notEmpty(url, 'url parameter cannot be empty');
    notEmpty(destFilename, 'destFilename parameter cannot be empty');

    var destFilepath = `${config.tmpdir}/${destFilename}`;
    child_process.execFileSync('curl', ['--silent', '--show-error', '-L', '-o', destFilepath, url], {
        encoding: 'utf-8'
    });

    return destFilepath;

};


/**
 * Copy contents of srcDir into existing targetDir
 * @srcDir eg. '/var/task'  ("/*" will be added automatically )
 * @targetDir eg. '/tmp/app'
 */
pack._copySync = function(srcDir, targetDir){
    child_process.execSync(`cp -r ${srcDir}/* ${targetDir}`);
}

pack._df = function(){
    var stdout = child_process.execSync('df -h');
    return stdout.toString();
};

pack._mkdirSync = function (dirName) {
    child_process.execSync(`mkdir -p ${dirName}`);
}

pack._unzipFileSync = function (zipFile, destFolder) {
    // how to run syn
    child_process.execSync(`unzip -o ${zipFile} -d ${destFolder}`, { timeout: 60 * SECOND });

}


pack._walkSync = function(currentDirPath, callback, excluded_files) {
    excluded_files = excluded_files || [];
    var fs = require('fs'),
        path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory() && (excluded_files.indexOf(name) < 0) )  {
            pack._walkSync(filePath, callback, excluded_files);
        }
    });
}


/*
* This is synchronous
* @opts.electronPackageUrl url to the electron package zip.
* @return electron path
*/
pack.installNightmare = function (opts) {

    var url, zipFile, zipPath;

    opts = opts || {};

    url = opts.electronPackageUrl || config.defaultElectronPackageUrl;
    zipPath = opts.zipPath || config.zipPath;

    zipFile = pack._downloadFileSync(url, `pck.zip`);

    pack._unzipFileSync(zipFile, '/tmp'); // will be into /tmp/pck folder

    pack._mkdirSync('/tmp/shm');

    // pack._mkdirSync('/tmp/app'); // this is directory for 'default.xkm'
    // no need for /tmp/app anymore

    return `/tmp/${zipPath}`;

};


pack.installNightmareOnLambdaEnvironment = function(opts){
    if ( !pack.isRunningOnLambdaEnvironment ) return;

    return pack.installNightmare(opts);

};


function notEmpty(argValue, msg) {
    if (!argValue) throw new Error(msg);
}
