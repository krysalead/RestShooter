/*globals exports:false, __config:false*/
/**
 * runner.js This file is the one that call the targeted server. It call then the checker to verify the response
 */
var http = require('http');
var https = require('https');
var querystring = require("querystring");
var checker = require('./checker.js');
var logger = require('./logger.js');
//var _ = require('lodash');
var Spinner = require('cli-spinner').Spinner;

var __context = {};
var __stepIndex = -1;
var __steps = [];
var __checks = [];
var __ran = [];
var __data = [];
var __input = [];
var __session = '';
var __endCallback = null;
//Not needed __config is available
exports.setContext = function (context) {
  __context = context;
  checker.setContext(context);
};

/**
 * Build the option to call the server based on the globale one and the specific to the step
 *
 * @param {}
 *          cfg
 * @return {}
 */
var getOption = function (cfg) {
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
};

/**
 * This method replace the variable ${} into the data passed in parameter according to the current content of the
 * scenario. '{id:${Login.ref}}' -> it will get from the Login step the node value of ref and replace in the string
 *
 * @param {String}
 *          data
 * @return {String} processed data
 */
var processData = function (data) {
  if (data === undefined) {
    return "";
  }
  //treat the output of previous request
  var R = new RegExp(/\$\{([\[\]0-9a-z\.]*)\}/ig),
    v, d = data;
  while ((v = R.exec(data)) != null) {
    var step = getStepVariableName(v[1]);
    var dot = v[1].split(".");
    dot.shift();
    var value = checker.getJsonNode(dot.join("."), __data[step]);
    logger.debug("Data Processing " + v[0] + " by " + value + " in " + d);
    if (value) {
      logger.debug("Processed " + v[0] + " by " + value + " in " + d);
      d = d.replace(v[0], value);
    }
  }

  //treat the input of previous calls
  R = new RegExp(/\$\{in\.([\[\]0-9a-z\.]*)\}/ig);
  while ((v = R.exec(data)) != null) {
    var step = getStepVariableName(v[1]);
    var dot = v[1].split(".");
    dot.shift();
    var value = checker.getJsonNode(dot.join("."), __input[step]);
    logger.debug("Data Processing " + v[0] + " by " + value + " in " + d);
    if (value) {
      logger.debug("Processed " + v[0] + " by " + value + " in " + d);
      d = d.replace(v[0], value);
    }
  }
  logger.debug("Processed " + d);
  return d;
};

var getStepVariableName = function (key) {
  return key.split(".").shift();
};

var logOptions = function (cfg, options) {
  logger.debug("Request Options", options);
  logger.debug("Request Data:" + cfg.data);
  logger.debug("Calling:[" + options.method + "] " + __context.protocol + "://" + options.hostname + ":" + options.port +
    options.path);
};

var responseHandler = function (response, options, cfg, report, callback) {
  response.setEncoding('utf8');
  var resData = "";
  response.on('data', function (chunk) {
    resData += chunk;
  });
  response.on('end', function () {
    report.spinner.stop();
    handleResponse(options.url, cfg, resData, report, callback, response);
  });
};

/**
 * Call a user hook and gives more information on the failure moment
 * @param {function} func hook to call
 * @param {Arrray} args the list of parameter to give to the function
 * @param {Object} step the step configuration
 * @param {String} type the name of the hook
 * @returns {*}
 */
var callHook = function (func, args, step, type) {
  try {
    if (func) {
      return func.apply(this, args);
    }
  } catch (e) {
    logger.error("Hook " + type + " fails on step:" + step.name);
    logger.error(e);
  }
};

var preRequest = function (cfg, options) {
  cfg.data = processData(cfg.data);
  //Call the pre process method if there is one
  callHook(__context.preRequest, [options, cfg], cfg, "Global preRequest");
  //Call the preRequest of the step
  callHook(cfg.preRequest, [options], cfg, "Step preRequest");
  //Build default param
  options.path += __context.params ? injecParameters(options.path, __context.params) : "";
  var spinner = new Spinner('processing.. %s');
  spinner.setSpinnerString('|/-\\');
  var report = {
    startedAt: (new Date()).getTime(),
    step: __steps[__stepIndex],
    messages: [],
    spinner: spinner
  };
  // post the data
  logger.debug("Requested at:" + report.startedAt);
  spinner.start();
  return report;
};

var getProtocol = function () {
  logger.debug("Protocol to use: " + (__context.protocol.toUpperCase() === "HTTP" ? "HTTP" : "HTTPS"));
  return __context.protocol.toUpperCase() === "HTTP" ? http : https;
};

var injecParameters = function (path, params) {
  var requestparam = (path.indexOf("?") == -1 ? "?" : "");
  requestparam += (path.indexOf("=") > -1 ? "&" : "");
  requestparam += params;
  return requestparam;
};

/**
 * Run a post call to the server
 * @param {Object} cfg step option
 * @param {Object} options request options
 * @param {Array} checks the list of checks to perform on the response
 * @param {function} callback as it is asynchronous call
 */
var runPost = function (cfg, options, checks, callback) {
  //Prepare the request, modify the options and configuration, log information and time
  var report = preRequest(cfg, options);
  options.headers['Content-Length'] = cfg.data.length;
  logOptions(cfg, options);
  // Set up the request
  var post_req = getProtocol().request(options, function (response) {
    responseHandler(response, options, cfg, report, callback);
  });
  post_req.write(cfg.data + "\n");
  post_req.end();

};

/**
 * Run a get call to the server
 * @param {Object} cfg step option
 * @param {Object} options request options
 * @param {Array} checks the list of checks to perform on the response
 * @param {function} callback as it is asynchronous call
 */
var runGet = function (cfg, options, checks, callback) {
  var report = preRequest(cfg, options);
  //Url encode the data
  if (cfg.data !== '') {
    options.path += injecParameters(options.path, escapeParameter(cfg.data));
  }
  logOptions(cfg, options);
  // Set up the request
  var get_req = getProtocol().request(options, function (response) {
    responseHandler(response, options, cfg, report, callback);
  });
  get_req.end();
};

/**
 * Escape only the value of the parameter and not the parameter so it splits the data as an array
 */
var escapeParameter = function (data) {
  //TODO : case of the path based parameter with no ? and &
  var arr = data.split("?");
  var index = arr.length > 1 ? 1 : 0;
  var params = arr[index].split("&");
  for (var i = 0; i < params.length; i++) {
    var p = params[i].split("=");
    params[i] = p[0] + "=" + querystring.escape(p[1]);
  }
  return params;
};

/**
 * Handle the server response
 * @param {Object} options the configuration of the request
 * @param {Object} cfg step configuration
 * @param {String} chunk the raw data from the servert
 * @param {Object} report the testing report with status of the test
 * @param {function} callback
 * @param {Object} server_response header and options of the response
 */
var handleResponse = function (options, cfg, chunk, report, callback, server_response) {
  report.endedAt = (new Date()).getTime();
  logger.store(chunk, cfg.name + ".rs");
  var cleaned = chunk;
  cleaned = callHook(__context.postRequest, [chunk, server_response, cfg], cfg, "postRequest");
  cleanedFromStep = callHook(cfg.postRequest, [chunk, server_response, cfg], cfg, "Step postRequest");

  //Priority to the step
  cleaned = cleanedFromStep ? cleanedFromStep : cleaned;

  logger.debug('STATUS: ' + server_response.statusCode);
  logger.debug('HEADERS: ' + JSON.stringify(server_response.headers));
  //Store the session
  __session = callHook(__context.getSession, [server_response, cleaned, cfg], cfg, "getSession");
  __sessionFromStep = callHook(cfg.getSession, [server_response, cleaned, cfg], cfg, "Step getSession");

  //Priority to the step
  __session = __sessionFromStep ? __sessionFromStep : __session;

  //report.messages=_.flatten(report.messages.push(checker.checkResponse(cleaned, report.checks)));
  report.messages = checker.checkResponse(cleaned, report.step.checks);
  //there is no error we can store the result
  __data[cfg.name] = cleaned;
  if (callback) {
    callback(report);
  }
};
/**
 * Function that trigger the next step to run enriching the report at each iteration
 * @param report
 */
var nextStep = function (report) {
  if (report) {
    __ran.push(report);
  }
  __stepIndex++;
  if (__steps.length > __stepIndex && (report == undefined || report.messages == undefined || report.messages.length ==
    0)) {
    var cfg = __steps[__stepIndex];
    var options = getOption(cfg);
    //Call the method to set the session
    callHook(__context.setSession, [options, cfg, __session], cfg, "setSession");
    callHook(cfg.setSession, [options, cfg, __session], cfg, "Step setSession");
    logger.info("Running Step:" + cfg.name);
    __input[cfg.name] = callHook(__context.parseInput, [cfg.data, cfg], cfg, "parseInput");

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

};

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
exports.run = function (steps, checks, endCallback) {
  __stepIndex = -1;
  __ran = [];
  __steps = steps;
  __checks = checks;
  __endCallback = endCallback;
  __data = [];
  nextStep();
};