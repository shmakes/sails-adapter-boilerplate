/**
 * Request Functions
 */
'use strict';

var http = require('http'),
    _    = require('lodash'),
    url  = require('url'),
    utils   = require('./utils');


module.exports = {

  /**
   * Makes an HTTP request
   * @param collection the collection the result object belongs to
   * @param methodName name of CRUD method being used
   * @param cb callback from method
   * @param options options from method
   * @param values values from method
   * @returns {*}
   */
  makeRequest: function(collection, methodName, cb, options, values) {
    var r = null,
        reqObj = null;
    var config = _.cloneDeep(collection.config);
    var baseUrl = url.format({
            protocol: config.protocol,
            hostname: config.hostname,
            port: config.port
          });
    var restMethod = config.methods[methodName];
    var pathname = config.pathname
           + '/' + config.database ;

    if (options && options.where) {
      // Add id to pathname if provided
      if (options.where.id) {
        pathname += '/'+ options.where.id;
        delete options.where.id;
      }
/*
      else if (methodName === 'destroy' || methodName == 'update') {
        // Find all and make new request for each.
        makeRequest(collection, 'find', function(error, results) {
          if (error) {
            cb(error);
          }
          else {
            _.each(results, function(result, i) {
              options = {
                where: {
                  id: result.id
                }
              };

              makeRequest(collection, methodName, (i + 1) === results.length ? cb : function(){}, options, values);
            });
          }
        }, options);

        return;
      }
*/

      // Add where statement as query parameters if requesting via GET or DELETE
      if (restMethod === 'get' || restMethod === 'delete') {
        _.extend(config.query, options.where);
      }
      // Set reqObj if additional where statements are available
      else if (_.size(options.where)) {
        reqObj = options.where;
      }
      else {
        delete options.where;
      }
    }
    else if (restMethod === 'get') {
      pathname += '/_design/' + config.ddocPrefix + '_' + config.resource 
                  + '/_view/' + config.resource + '_all'
                  + (config.action ? '/' + config.action : '');
    }

    if (!reqObj && values) {
      reqObj = values;

      // Make sure the type is set for POST and PUT.
      if (restMethod === 'post' || restMethod === 'put') {
        if (!reqObj.type) {
          _.extend(reqObj, {'type': config.resource});
        }
      }

      if (options) {
        reqObj = _.extend(options, reqObj);
      }
    }

    // Add pathname to config
    _.extend(config, {pathname: pathname});

    // Format URI
    var uri = url.format(config);

    if (r) {
      cb(null, r);
    }
    else {
      var path = uri.replace(baseUrl, '');

      var opts = {
        host: config.hostname,
        port: config.port,
        path: path,
        method: restMethod
      };

      // Set authentication, if available.
      if (config.user && config.password) {
        var auth = 'Basic ' + new Buffer(config.user + ':' + config.password).toString('base64');
        opts = _.extend(opts, {'Authorization': auth});
      }

      var reqBody;
      if (reqObj) {
        reqBody = JSON.stringify(reqObj);
        var pheaders = {'headers': {
            'Content-Type' : 'application/json',
            'Content-Length' : Buffer.byteLength(reqBody, 'utf8')
          }
        };
        opts = _.extend(opts, pheaders);
      }

      var callback = function(res) {
        var data = '';
        res.setEncoding('utf8');

        if (res.statusCode > 399 && res.statusCode < 500) {
          cb(null, []);
          return false;
        }

        res.on('error', function(e) {
          cb(e);
        });

        res.on('data', function (chunk) {
          data += chunk;
        });

        res.on('end', function () {
          var obj = JSON.parse(data);
          if (methodName === 'find') {
            r = utils.getResultsAsCollection(obj, collection);
          }
          else {
            r = utils.formatResult(obj, collection);
          }
          cb(null, r);
        });
      };

      console.log(opts);
      //
      // Make request via http
      var req = http.request(opts, callback);
      req.on('error', function(e) {
        cb(e);
      });

      if (reqBody) {
        req.write(reqBody);
        console.log(reqBody);
      }
      req.end();
    }

    return false;
  }
};
