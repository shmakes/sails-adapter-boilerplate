/*---------------------------------------------------------------
  :: sails-couchdb
  -> adapter
---------------------------------------------------------------*/

var _       = require('lodash'),
    request = require('./request');

module.exports = (function() {

  var collections = {};
  console.log('Start CouchDB Adapter');

  var adapter = {

    // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
    // If true, the schema for models using this adapter will be automatically synced when the server starts.
    // Not terribly relevant if not using a non-SQL / non-schema-ed data store
    syncable: false,

    // Default configuration for collections
    // (same effect as if these properties were included at the top level of the model definitions)
    defaults: {
        hostname: 'localhost',
        database: 'sails',
        port: 5984,
        user: null,
        password: null,
        protocol: 'http',
        ddocPrefix: 'sails',
        pathname: '',
        resource: null,
        action: null,
        query: {},
        methods: {
          create: 'post',
          find: 'get',
          update: 'put',
          destroy: 'delete'
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
            hostname: config.hostname,
            port: config.port,
            database: config.database,
            pathname: config.pathname,
            user: config.user,
            password: config.password,
            ddocPrefix: config.ddocPrefix,
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
        debugger;
        request.makeRequest(collections[collectionName], 'create', cb, null, values);
      },

      find: function(collectionName, options, cb){
        debugger;
        request.makeRequest(collections[collectionName], 'find', cb, options);
      },

      update: function(collectionName, options, values, cb) {
        debugger;
        request.makeRequest(collections[collectionName], 'update', cb, options, values);
      },

      destroy: function(collectionName, options, cb) {
        debugger;
        request.makeRequest(collections[collectionName], 'find', function(err, models) {
          if (!models) return cb(err);
          if (models.length < 1) return cb(err);
          _.extend(options.where, {'id': models[0]._id, 'rev': models[0]._rev});
          request.makeRequest(collections[collectionName], 'destroy', cb, options);
        }, options);
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

