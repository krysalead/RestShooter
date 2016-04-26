/**
 * Checker.js This object is validating the request, based on the instruction of the steps and scenario
 */
var logger = require('./logger.js');

var __context = {};
/**
 * Context propagation, this method is receiving the context of the shoot
 *
 * @param {Object}
 *          context
 */
exports.setContext = function(context) {
  __context = context;
  logger.setContext(context);
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
 * Update the diff value based on current value
 */
var updateDiff = function(current, _new_) {
  if (_new_ == 0) {
    return current; //nothing to change
  }
  if (current == 0) {
    return _new_; //this one is the modifier
  }
  if (current * _new_ > 0) {
    return _new_; // current or new are the same -1 or 1
  }
  if (current * _new_ < 0) {
    return 2; // current or new are the different -1 and 1 or vice versa
  }
  return _new_;
};
/**
 * Compare json1 with json2 and return 0 if identical, 1 if the json1 contains more keys, -1 if json2 contains more keys, -2 if both have different keys
 */
exports.compareJSONKeys = function(json1, json2) {
  var compare = function(_json1_, _json2_) {
    var result = {
      diff: 0,
      keys_json1: [],
      keys_json2: []
    };
    for (var key in _json1_) {
      //If the key exists in the other json we delete it
      if (_json2_[key]) {
        if (typeof _json1_[key] === 'object') {
          var r = compare(_json1_[key], _json2_[key]);
          result.diff = updateDiff(result.diff, r.diff);
          result.keys_json1 = result.keys_json1.concat(r.keys_json1);
          result.keys_json2 = result.keys_json2.concat(r.keys_json2);
        }
        delete _json2_[key];
      } else {
        result.diff = updateDiff(result.diff, 1);
        result.keys_json1.push(key);
      }
    }
    //Check that we should not go here
    var hasMoreKeys;
    for (var k in _json2_) {
      result.keys_json2.push(k);
      hasMoreKeys = true;
    }
    if (hasMoreKeys) {
      result.diff = updateDiff(result.diff, -1);
    }
    return result;
  };
  //As we are removing keys we should keep a copy
  return compare(json1, JSON.parse(JSON.stringify(json2)));
};

exports.getJsonFromFile= function(path){
  return JSON.parse(require(path));
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
      var tests = (typeof checks[i].test === 'string' || checks[i].test instanceof String) ? checks[i].test.split("|") : [
        checks[i].test
      ];
      logger.debug("Performing tests:");
      logger.debug(tests);
      while (tests.length > 0) {
        var tst = tests.shift();
        var msg = null;
        switch (tst) {
          case 'notexist':
            if (node !== undefined) {
              msg = "The " + checks[i].path + " must not exist in the answer";
            }
            break;
          case 'exist':
            if (node === undefined) {
              msg = "The " + checks[i].path + " must exist in the answer";
            }
            break;
          case 'existnotnull':
            if (node === undefined || node === null) {
              msg = "The " + checks[i].path + " must exist and not be null in the answer";
            }
            break;
          case 'notempty':
            if (node === '') {
              msg = "The " + checks[i].path + " must not be empty in the answer";
            }
            break;
          case 'empty':
            if (node !== '') {
              msg = "The " + checks[i].path + " must be empty in the answer";
            }
            break;
          case 'struct':
            var reference = exports.getJsonFromFile(checks[i].path);
            var comparison = exports.compareJSONKeys(reference,response);
            switch(comparison.diff){
              case -1:
                msg = "Reference has more key -> "+JSON.stringify(comparison.keys_json2);
                break;
              case 1:
                msg = "Response has more key -> "+JSON.stringify(comparison.keys_json1);
                break;
              case 2:
                msg = "Response and Reference have different keys";
                logger.debug(JSON.stringify(comparison.keys_json2) + "<-->" + JSON.stringify(comparison.keys_json1));
                break;
            }
            break;
          default:
            if (node !== tst) {
              msg = "Expected value for '" + checks[i].path + "' is '" + tst + "' but was '" + node + "'";
            }
        }
        if (msg !== null) {
          messages.push(msg);
          logger.error(msg);
        }
      }
    }
  }
  logger.info("########################################################");
  return messages;

}