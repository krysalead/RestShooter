/**
 * Checker.js This object is validating the request, based on the instruction of the steps and scenario
 */
util = require('util');
assert = require('assert');

var __context = {};
/**
 * Context propagation, this method is receiving the context of the shoot
 *
 * @param {Object}
 *          context
 */
exports.setContext = function(context) {
  __context = context;
};

/**
 * This method is exposed to external. It extract from the response object a path specified
 *
 * @param {String}
 *          path this is a string with . (dot) that represent the path to a node we want be returned
 * @param {Object}
 *          response it is a JSON object (Not stringified) where the path will be retrieved
 * @return {Object} the value of the node
 */
exports.getJsonNode = function(path, response) {
  return getJsonNode(path, response);
}

/**
 * It extract from the response object a path specified
 *
 * @param {String}
 *          path this is a string with . (dot) that represent the path to a node we want be returned
 * @param {Object}
 *          response it is a JSON object (Not stringified) where the path will be retrieved
 * @return {Object} the value of the node
 */
getJsonNode = function(path, response) {
  logger.debug("getJsonNode ->" + path);
  var dot = path.split('.');
  var o = response;
  try {
    while (dot.length > 0) {
      var key = dot.shift();
      if (key.indexOf('[') != -1) {
        var index = key.substr(key.indexOf('[') + 1, key.indexOf(']') - (key.indexOf('[') + 1));
        key = key.substr(0, key.indexOf('['));
        o = o[key][index];
      } else {
        o = o[key];
      }
    }
  } catch (e) {

  }
  return o;
}

/**
 * This method is exposed to external. Based on the Response and the checks passed in parameter it will validate the
 * request
 *
 * @param {Object}
 *          response a JSON object that represent the response
 * @param {Array}
 *          checks array of checks to be performed
 * @return {Array} the returned value is an array of message (empty if nothing happen)
 */
exports.checkResponse = function(response, checks) {
  logger.info("-------------------------------------------------");
  var messages = [];
  for (var i = 0; i < checks.length; i++) {
    logger.info("Checking:" + checks[i].path);
    var node = getJsonNode(checks[i].path, response);
    if (checks[i].test !== undefined && checks[i].test !== null) {
      var tests = (typeof checks[i].test === 'string' || checks[i].test instanceof String) ? checks[i].test.split("|") :
        [checks[i].test];
      logger.debug("Performing tests:");
      logger.debug(tests);
      while (tests.length > 0) {
        var tst = tests.shift()
        switch (tst) {
          case 'notexist':
            if (node === undefined) {
              messages.push("The " + checks[i].path + " must not exist in the answer");
              logger.error("The " + checks[i].path + " must not exist in the answer");
            }
            break;
          case 'exist':
            if (node === undefined) {
              messages.push("The " + checks[i].path + " must exist in the answer");
              logger.error("The " + checks[i].path + " must exist in the answer");
            }
            break;
          case 'existnotnull':
            if (node === undefined || node === null) {
              messages.push("The " + checks[i].path + " must exist and not be null in the answer");
              logger.error("The " + checks[i].path + " must exist and not be null  in the answer");
            }
            break;
          case 'notempty':
            if (node === '') {
              messages.push("The " + checks[i].path + " must not be empty in the answer");
              logger.error("The " + checks[i].path + " must not be empty in the answer");
            }
            break;
          case 'empty':
            if (node === '') {
              messages.push("The " + checks[i].path + " must be empty in the answer");
              logger.error("The " + checks[i].path + " must be empty in the answer");
            }
            break;
          default:
            if (node !== tst) {
              messages.push("Expected value for '" + checks[i].path + "' is '" + tst + "' but was '" + node + "'");
              logger.error("Expected value for '" + checks[i].path + "' is '" + tst + "' but was '" + node + "'");
            }

        }
      }
    }
  }
  logger.info("########################################################");
  return messages;

}