/**
 * Utility Functions
 */
'use strict';

var _ = require('lodash');

module.exports = {

  // Private functions
  /**
   * Format result object according to schema
   * @param result result object
   * @param collection the collection the result object belongs to
   * @returns {*}
   */
  formatResult: function(result, collection) {
    var config = collection.config;

    if (_.isFunction(config.beforeFormatResult)) {
      result = config.beforeFormatResult(result);
    }

    _.each(collection.definition, function(def, key) {
      if (def.type.match(/date/i)) {
        result[key] = new Date(result[key] || null);
      }
    });

    if (_.isFunction(config.afterFormatResult)) {
      result = config.afterFormatResult(result);
    }

    return result;
  },

  /**
   * Format results according to schema
   * @param results array of result objects (model instances)
   * @param collection the collection the result object belongs to
   * @returns {*}
   */
  formatResults: function(results, collection){
    var utils = this;
    var config = collection.config;

    if (_.isFunction(config.beforeFormatResults)) {
      results = config.beforeFormatResults(results);
    }
/*
    results.forEach(function(result) {
      utils.formatResult(result, collection);
    });
*/
    if (_.isFunction(config.afterFormatResults)) {
      results = config.afterFormatResults(results);
    }

    return results;
  },

  /**
   * Ensure results are contained in an array. Resolves variants in API responses such as `results` or `objects` instead of `[.....]`
   * @param data response data to format as results array
   * @param collection the collection the result object belongs to
   * @returns {*}
   */
  getResultsAsCollection: function(data, collection){
    var utils = this;
    var d = (data.rows || data.objects || data.results || data),
        a = _.isArray(d) ? d : [d];

    return utils.formatResults(a, collection);
  }
};
