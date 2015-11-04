/**
 * runner.js This file is the one that call the targeted server. It call then the checker to verify the response
 */
http = require('http');
querystring = require("querystring");
xmlParser = require('xml2js').parseString;
checker = require('./checker.js');
logger = require('./logger.js');

var __context = {};
var __stepIndex = -1;
var __steps = [];
var __checks = [];
var __ran = [];
var __data = [];
var __session = '';
//Not needed __config is available
exports.setContext = function(context) {
  __context = context;
  logger.debug("Has a postRequest function:" + isFunction(__context.postRequest));
  if (!isFunction(__context.postRequest)) {
    logger.debug("Trying to fallback to:" + __context.content);
    if (__context.content && __context.content.toUpperCase() === "JSON") {
      __context.postRequest = parseJson;
    }
    if (__context.content && __context.content.toUpperCase() === "XML") {
      __context.postRequest = parseXML;
    }
  }
  checker.setContext(context);
};

function parseJson(data, server_response) {
  logger.debug("Automatic JSON parsing");
  return JSON.parse(data);
}

function parseXML(data, server_response) {
  logger.debug("Automatic XML parsing");
  xmlParser(data, function(err, result) {
    callback.call({
      data: result,
      getnode: checker.getJsonNode
    });
  });
}

function isFunction(object) {
  return (typeof object === 'function');
}

/**
 * Build the option to call the server based on the globale one and the specific to the step
 *
 * @param {}
 *          cfg
 * @return {}
 */
getOption = function(cfg) {
  var opt = {
    hostname: __config.server,
    port: __config.port,
    path: __config.baseUrl + cfg.url,
    method: cfg.method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  return opt;
}

/**
 * This method replace the variable ${} into the data passed in parameter according to the current content of the
 * scenario. '{id:${Login.ref}}' -> it will get from the Login step the node value of ref and replace in the string
 *
 * @param {String}
 *          data
 * @return {String} processed data
 */
processData = function(data) {
  if (data === undefined) {
    return "";
  }
  var R = new RegExp(/\$\{([\[\]0-9a-z\.]*)\}/ig),
    v, d = data;
  while ((v = R.exec(data)) != null) {
    var step = getStepVariableName(v[1]);
    var dot = v[1].split(".");
    dot.shift();
    var value = checker.getJsonNode(dot.join("."), __data[step]);
    logger.debug("Processing " + v[0] + " by " + value + " in " + d);
    d = d.replace(v[0], value);
  }
  logger.debug("Processed " + d);
  return d;
}

getStepVariableName = function(key) {
  return key.split(".").shift();
}

runPost = function(cfg, options, checks, callback) {
  var data = processData(cfg.data);
  options.headers['Content-Length'] = data.length;
  //Call the pre process method if there is one
  if (isFunction(__context.preRequest)) {
    __context.preRequest(options);
  }
  options.path += __context.params ? options.path.indexOf("=") > -1 ? "&" + __context.params : __context.params : "";
  logger.debug("Request Options", options);
  logger.debug("Calling:[" + options.method + "] http://" + options.hostname + ":" + options.port + options.path +
    (options.commonParam ? options.commonParam : ""));
  // Set up the request
  var post_req = http.request(options, function(response) {
    response.setEncoding('utf8');
    var resData = "";
    response.on('data', function(chunk) {
      resData += chunk;
    });
    response.on('end', function(){
      handleResponse(options.url, cfg, resData, checks, callback, response);
    })
  });

  // post the data
  logger.debug("Request Data:" + data);
  post_req.write(data + "\n");
  post_req.end();

}

runGet = function(cfg, options, checks, callback) {
  var data = processData(cfg.data);
  //Url encode the data
  if (data !== '') {
    options.path += escapeParameter(data);
  }
  //Call the pre process method if there is one
  if (isFunction(__context.preRequest)) {
    __context.preRequest(options);
  }
  options.path += __context.params ? options.path.indexOf("=") > -1 ? "&" + __context.params : __context.params : "";
  logger.debug("Calling:[" + options.method + "] http://" + options.hostname + ":" + options.port + options.path);
  // Set up the request
  var get_req = http.request(options, function(response) {
    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      handleResponse(options, cfg, chunk, checks, callback, response);
    });
  });
  logger.debug("Request Data:" + data);
  get_req.end();
}

/**
 * Escape only the value of the parameter and not the parameter so it splits the data as an array
 */
escapeParameter = function(data) {
  //TODO : case of the path based parameter with no ? and &
  var arr = data.split("?");
  var index = arr.length > 1 ? 1 : 0;
  var params = arr[index].split("&");
  for (var i = 0; i < params.length; i++) {
    var p = params[i].split("=");
    params[i] = p[0] + "=" + querystring.escape(p[1]);
  }
  return arr[0] + "?" + params;
}

handleResponse = function(options, cfg, chunk, checks, callback, server_response) {
  logger.debug("Response data:");
  logger.debug(chunk);
  logger.store(chunk, cfg.name + ".rs");
  var cleaned = chunk;
  if (isFunction(__context.postRequest)) {
    cleaned = __context.postRequest(chunk, server_response);
  }
  //Store the session
  __session = __context.getSession(server_response, cleaned);
  var messages = checker.checkResponse(cleaned, checks);
  //there is no error we can store the result
  __data[cfg.name] = cleaned;
  if (callback) {
    callback(messages, __steps[__stepIndex]);
  }
}

nextStep = function(messages, step) {
  if (messages || step) {
    __ran.push({
      messages: messages,
      step: step
    });
  }
  __stepIndex++
  if (__steps.length > __stepIndex && (messages == undefined || messages.length == 0)) {
    var cfg = __steps[__stepIndex];
    var options = getOption(cfg);
    //Call the method to set the session
    __context.setSession(options, cfg, __session);
    logger.info("Running Step:" + cfg.name);

    var checks = __checks != undefined ? __checks : [];
    if (cfg.checks) {
      checks = checks.concat(cfg.checks);
    }
    logger.debug("Loaded checks: ", checks);
    logger.debug("++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
    if (cfg.method.toUpperCase() == 'POST') {
      runPost(cfg, options, checks, nextStep);
    } else {
      runGet(cfg, options, checks, nextStep);
    }
  } else {
    if (__endCallback) {
      __endCallback(__ran);
    }
  }

}

/**
 * Entry point of the runner It will process all the steps passed un parameter and apply all the common checks, then it
 * will call the endcallback
 *
 * @param {Array}
 *          steps a list of step object
 * @param {Array}
 *          checks a list of checks to perfom on each step
 * @param {Function}
 *          endCallback to be called once everything is done
 */
exports.run = function(steps, checks, endCallback) {
  __stepIndex = -1;
  __steps = steps;
  __checks = checks
  __endCallback = endCallback;
  __data = [];
  nextStep();
}