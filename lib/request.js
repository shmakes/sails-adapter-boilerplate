
  /**
   * Makes a HTTP request
   * @param collectionName name of collection the result object belongs to
   * @param methodName name of CRUD method being used
   * @param cb callback from method
   * @param options options from method
   * @param values values from method
   * @returns {*}
   */
  function makeRequest(collectionName, methodName, cb, options, values) {
    var r = null,
        opt = null,
        cache = collections[collectionName].cache,
        config = _.cloneDeep(collections[collectionName].config),
        connection = collections[collectionName].connection,
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
      // Set opt if additional where statements are available
      else if (_.size(options.where)) {
        opt = options.where;
      }
      else {
        delete options.where;
      }
    }

    if (!opt && values) {
      opt = values;

      if (options) {
        opt = _.extend(options, opt);
      }
    }

    // Add pathname to connection
    _.extend(config, {pathname: pathname});

    // Format URI
    var uri = url.format(config);

    // Retrieve data from the cache
    if (methodName === 'find') {
      r = cache && cache.engine.get(uri);
    }

    if (r) {
      cb(null, r);
    }
    else if (_.isFunction(connection[restMethod])) {
      var path = uri.replace(connection.url.href, '/');

      var callback = function(err, req, res, obj) {
        if (err) {
          cb(err);
        }
        else {
          if (methodName === 'find') {
            r = getResultsAsCollection(obj, collectionName);

            if (cache) {
              cache.engine.set(uri, r);
            }
          }
          else {
            r = formatResult(obj, collectionName);

            if (cache) {
              cache.engine.del(uri);
            }
          }

          cb(null, r);
        }
      };

      // Make request via restify
      if (opt) {
        connection[restMethod](path, opt, callback);
      }
      else {
        connection[restMethod](path, callback);
      }
    }
    else {
      cb(new Error('Invalid REST method: ' + restMethod));
    }

    return false;
  }

