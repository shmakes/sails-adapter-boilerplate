/*---------------------------------------------------------------
  :: sails-couchdb
  -> adapter
---------------------------------------------------------------*/

var http    = require('http'),
    url     = require('url'),
    _       = require('lodash');

module.exports = (function() {
  "use strict";

  var collections = {};

  // Private functions
  /**
   * Format result object according to schema
   * @param result result object
   * @param collectionName name of collection the result object belongs to
   * @returns {*}
   */
  function formatResult(result, collectionName){
    var config = collections[collectionName].config;

    if (_.isFunction(config.beforeFormatResult)) {
      result = config.beforeFormatResult(result);
    }

    _.each(collections[collectionName].definition, function(def, key) {
      if (def.type.match(/date/i)) {
        result[key] = new Date(result[key] ? result[key] : null);
      }
    });

    if (_.isFunction(config.afterFormatResult)) {
      result = config.afterFormatResult(result);
    }

    return result;
  }

  /**
   * Format results according to schema
   * @param results array of result objects (model instances)
   * @param collectionName name of collection the result object belongs to
   * @returns {*}
   */
  function formatResults(results, collectionName){
    var config = collections[collectionName].config;

    if (_.isFunction(config.beforeFormatResults)) {
      results = config.beforeFormatResults(results);
    }

    results.forEach(function(result) {
      formatResult(result, collectionName);
    });

    if (_.isFunction(config.afterFormatResults)) {
      results = config.afterFormatResults(results);
    }

    return results;
  }

  /**
   * Ensure results are contained in an array. Resolves variants in API responses such as `results` or `objects` instead of `[.....]`
   * @param data response data to format as results array
   * @param collectionName name of collection the result object belongs to
   * @returns {*}
   */
  function getResultsAsCollection(data, collectionName){
    var d = (data.objects || data.results || data),
        a = _.isArray(d) ? d : [d];

    return formatResults(a, collectionName);
  }

  /**
   * Makes an HTTP request
   * @param collectionName name of collection the result object belongs to
   * @param methodName name of CRUD method being used
   * @param cb callback from method
   * @param options options from method
   * @param values values from method
   * @returns {*}
   */
  function makeRequest(collectionName, methodName, cb, options, values) {
    var r = null,
        reqObj = null,
        cache = collections[collectionName].cache,
        config = _.cloneDeep(collections[collectionName].config),
        baseUrl = url.format({
            protocol: config.protocol,
            hostname: config.host,
            port: config.port
          }),
        restMethod = config.methods[methodName],
        pathname = config.pathname + '/' + config.resource + (config.action ? '/' + config.action : '');

    if (options && options.where) {
      // Add id to pathname if provided
      if (options.where.id) {
        pathname += '/'+ options.where.id;
        delete options.where.id;
      }
      else if (methodName === 'destroy' || methodName == 'update') {
        // Find all and make new request for each.
        makeRequest(collectionName, 'find', function(error, results) {
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

              makeRequest(collectionName, methodName, (i + 1) === results.length ? cb : function(){}, options, values);
            });
          }
        }, options);

        return;
      }

      // Add where statement as query parameters if requesting via GET
      if (restMethod === 'get') {
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

    if (!reqObj && values) {
      reqObj = values;

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
      var path = uri.replace(baseUrl, '/');

      var opts = {
        host: config.host,
        port: config.port,
        path: path,
        method: restMethod
      };

      // Set authentication, if available.
      if (config.user && config.password) {
        var auth = 'Basic ' + new Buffer(config.user + ':' + config.password).toString('base64');
        opts = _.extend(auth, opts);
      }

      var callback = function(res) {
        var data = {};
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          data += chunk;
        });

        res.on('end', function () {
          if (methodName === 'find') {
            r = getResultsAsCollection(obj, collectionName);
          }
          else {
            r = formatResult(obj, collectionName);
          }
          cb(null, r);
        });
      };

      // Make request via http
      var req = http.request(options, callback);
      req.on('error', function(e) {
        cb(e);
      });

      if (reqObj) {
        req.write(reqObj);
      }
      req.end();
    }
    else {
      cb(new Error('Invalid HTTP method: ' + restMethod));
    }

    return false;
  }

  var adapter = {

    // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
    // If true, the schema for models using this adapter will be automatically synced when the server starts.
    // Not terribly relevant if not using a non-SQL / non-schema-ed data store
    syncable: false,

    // Default configuration for collections
    // (same effect as if these properties were included at the top level of the model definitions)
    defaults: {
        host: 'localhost',
        database: 'sails',
        port: 5984,
        user: null,
        password: null
        protocol: 'http',
        pathname: '',
        resource: null,
        action: null,
        query: {},
        methods: {
          create: 'post',
          find: 'get',
          update: 'put',
          destroy: 'del'
        },
        beforeFormatResult: null,
        afterFormatResult: null,
        beforeFormatResults: null,
        afterFormatResults: null
    },

    // This method runs when a model is initially registered at server start time
    registerCollection: function(collection, cb) {
        var config, instance;

        config = _.extend({}, collection.defaults, collection.config);

        instance = {
          config: {
            protocol: config.protocol,
            hostname: config.host,
            port: config.port,
            pathname: config.pathname,
            headers: config.headers,
            query: config.query,
            resource: config.resource || collection.identity,
            action: config.action,
            methods: _.extend({}, collection.defaults.methods, config.methods),
            beforeFormatResult: config.beforeFormatResult,
            afterFormatResult: config.afterFormatResult,
            beforeFormatResults: config.beforeFormatResults,
            afterFormatResults: config.afterFormatResults
          },

          definition: collection.definition
        };

        collections[collection.identity] = instance;

        cb();
    },


    // The following methods are optional
    ////////////////////////////////////////////////////////////

    // Optional hook fired when a model is unregistered, typically at server halt
    // useful for tearing down remaining open connections, etc.
    teardown: function(cb) {
      cb();
    },


    // REQUIRED method if integrating with a schemaful database
    define: function(collectionName, definition, cb) {

      // Define a new "table" or "collection" schema in the data store
      cb();
    },
    // REQUIRED method if integrating with a schemaful database
    describe: function(collectionName, cb) {

      // Respond with the schema (attributes) for a collection or table in the data store
      var attributes = {};
      cb(null, attributes);
    },
    // REQUIRED method if integrating with a schemaful database
    drop: function(collectionName, cb) {
      // Drop a "table" or "collection" schema from the data store
      cb();
    },

    // Optional override of built-in alter logic
    // Can be simulated with describe(), define(), and drop(),
    // but will probably be made much more efficient by an override here
    // alter: function (collectionName, attributes, cb) { 
    // Modify the schema of a table or collection in the data store
    // cb(); 
    // },


      create: function(collectionName, values, cb) {
        makeRequest(collectionName, 'create', cb, null, values);
      },

      find: function(collectionName, options, cb){
        makeRequest(collectionName, 'find', cb, options);
      },

      update: function(collectionName, options, values, cb) {
        makeRequest(collectionName, 'update', cb, options, values);
      },

      destroy: function(collectionName, options, cb) {
        makeRequest(collectionName, 'destroy', cb, options);
      },


    // REQUIRED method if users expect to call Model.stream()
    stream: function(collectionName, options, stream) {
      // options is a standard criteria/options object (like in find)

      // stream.write() and stream.end() should be called.
      // for an example, check out:
      // https://github.com/balderdashy/sails-dirty/blob/master/DirtyAdapter.js#L247

    }



    /*
    **********************************************
    * Optional overrides
    **********************************************

    // Optional override of built-in batch create logic for increased efficiency
    // otherwise, uses create()
    createEach: function (collectionName, cb) { cb(); },

    // Optional override of built-in findOrCreate logic for increased efficiency
    // otherwise, uses find() and create()
    findOrCreate: function (collectionName, cb) { cb(); },

    // Optional override of built-in batch findOrCreate logic for increased efficiency
    // otherwise, uses findOrCreate()
    findOrCreateEach: function (collectionName, cb) { cb(); }
    */


    /*
    **********************************************
    * Custom methods
    **********************************************

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // > NOTE:  There are a few gotchas here you should be aware of.
    //
    //    + The collectionName argument is always prepended as the first argument.
    //      This is so you can know which model is requesting the adapter.
    //
    //    + All adapter functions are asynchronous, even the completely custom ones,
    //      and they must always include a callback as the final argument.
    //      The first argument of callbacks is always an error object.
    //      For some core methods, Sails.js will add support for .done()/promise usage.
    //
    //    + 
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////////


    // Any other methods you include will be available on your models
    foo: function (collectionName, cb) {
      cb(null,"ok");
    },
    bar: function (collectionName, baz, watson, cb) {
      cb("Failure!");
    }


    // Example success usage:

    Model.foo(function (err, result) {
      if (err) console.error(err);
      else console.log(result);

      // outputs: ok
    })

    // Example error usage:

    Model.bar(235, {test: 'yes'}, function (err, result){
      if (err) console.error(err);
      else console.log(result);

      // outputs: Failure!
    })

    */


  };

  return adapter;
})();

