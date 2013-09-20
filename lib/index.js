var fs = require('fs');
var path = require('path');

var libpath = process.env.TEST_COV ? '../lib-cov/' : '../lib/';
var detector = require(libpath + 'detector');

var http = require('http'),
    https = require('https');

var handlers = {};
['png', 'gif', 'bmp', 'psd', 'jpg', 'webp'].forEach(function (type) {
  handlers[type] = require(libpath + 'types/' + type);
});

function lookup (buffer) {
  // detect the file type.. don't rely on the extension
  var type = detector(buffer);

  if (type in handlers) {
    return handlers[type](buffer);
  } else {
    throw new TypeError('unsupported file type');
  }
}

function loadFromFile(filepath, callback) {
  // create a buffer to read data in
  var buffer = new Buffer(1024);

  if (typeof callback === 'function') {
    // read first 1KB from the file, asynchronously
    fs.open(filepath, 'r', function (err, descriptor) {

      if (err) {
        return callback(err);
      }

      fs.read(descriptor, buffer, 0, 1024, 0, function (err) {
        if (err) {
          return callback(err);
        }

        // return the dimensions
        var dimensions = lookup(buffer);
        callback(null, dimensions);
      });
    });
  } else {
    // read first 1KB from the file, synchronously
    var descriptor = fs.openSync(filepath, 'r');
    fs.readSync(descriptor, buffer, 0, 1024, 0);

    // return the dimensions
    return lookup(buffer);
  }
}

function loadFromURL(filepath, callback) {
  // create a buffer to read data in
  var buffer = new Buffer(1024),
      offset = 0,
      requestLib = /^https/.test(filepath) ? https : http,
      options = require('url').parse(filepath);

  options.rejectUnauthorized = false;

  var request = requestLib.get(filepath, function(resp) {
    resp.on('data', function(chunk) {

      if (offset <= 1024) {
        chunk.copy(buffer, offset, 0, buffer.length - offset);
        offset += chunk.length;

        if (offset > 1024) {
          request.abort();

          // return the dimensions
          var dimensions = lookup(buffer);
          callback(null, dimensions);
        }
      }

    });
  }).on("error", function(err) {
    callback(err);
  });
}

/**
 * @params filepath - relative/absolute path of the image file
 * @params callback - optional function for async detection
 */
module.exports = function (filepath, callback) {

  if (/^https?\:\/\//.test(filepath)) {

    // URL
    return loadFromURL(filepath, callback);

  } else {

    // resolve the file path
    filepath = path.resolve(filepath);

    return loadFromFile(filepath, callback);

  }

};