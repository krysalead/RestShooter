/**
 * runner.js This file is the one that call the targeted server. It call then the checker to verify the response
 */
var http = require('http');
var https = require('https');
var querystring = require("querystring");
var xmlParser = require('xml2js').parseString;
var checker = require('./checker.js');
var logger = require('./logger.js');
var _ = require('lodash');
var Spinner = require('cli-spinner').Spinner;

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

logOptions = function(cfg, options) {
  logger.debug("Request Options", options);
  logger.debug("Calling:[" + options.method + "] " + __context.protocol + "://" + options.hostname + ":" + options.port +
    options.path +
    (options.commonParam ? options.commonParam : ""));
}

responseHandler = function(response, options, cfg, report, callback) {
  response.setEncoding('utf8');
  var resData = "";
  response.on('data', function(chunk) {
    resData += chunk;
  });
  response.on('end', function() {
    report.spinner.stop();
    handleResponse(options.url, cfg, resData, report, callback, response);
  })
}

preRequest = function(cfg, options) {
  cfg.data = processData(cfg.data);
  //Call the pre process method if there is one
  if (isFunction(__context.preRequest)) {
    __context.preRequest(options);
  }
  options.path += __context.params ? options.path.indexOf("=") > -1 ? "&" + __context.params : __context.params : "";
  logOptions(cfg, options);
  var spinner = new Spinner('processing.. %s');
  spinner.setSpinnerString('|/-\\');
  var report = {
      startedAt: (new Date()).getTime(),
      step: __steps[__stepIndex],
      messages: [],
      spinner: spinner
    }
    // post the data
  logger.debug("Requested at:" + report.startedAt);
  logger.debug("Request Data:" + cfg.data);
  spinner.start();
  return report;
}

getProtocol = function() {
  return __context.protocol.toUpperCase === "HTTP" ? http : https;
}

runPost = function(cfg, options, checks, callback) {
  //Prepare the request, modify the options and configuration, log information and time
  var report = preRequest(cfg, options);
  options.headers['Content-Length'] = cfg.data.length;
  // Set up the request
  var post_req = getProtocol().request(options, function(response) {
    responseHandler(response, options, cfg, report, callback)
  });
  post_req.write(cfg.data + "\n");
  post_req.end();

}

runGet = function(cfg, options, checks, callback) {
  var report = preRequest(cfg, options);
  //Url encode the data
  if (cfg.data !== '') {
    options.path += escapeParameter(cfg.data);
  }
  // Set up the request
  var get_req = getProtocol().request(options, function(response) {
    responseHandler(response, options, cfg, report, callback)
  });
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

handleResponse = function(options, cfg, chunk, report, callback, server_response) {
  report.endedAt = (new Date()).getTime();
  logger.store(chunk, cfg.name + ".rs");
  var cleaned = chunk;
  if (isFunction(__context.postRequest)) {
    cleaned = __context.postRequest(chunk, server_response);
  }
  logger.debug('STATUS: ' + server_response.statusCode);
  logger.debug('HEADERS: ' + JSON.stringify(server_response.headers));
  //Store the session
  __session = __context.getSession(server_response, cleaned);
  //report.messages=_.flatten(report.messages.push(checker.checkResponse(cleaned, report.checks)));
  report.messages = checker.checkResponse(cleaned, report.step.checks);
  //there is no error we can store the result
  __data[cfg.name] = cleaned;
  if (callback) {
    callback(report);
  }
}

nextStep = function(report) {
  if (report) {
    __ran.push(report);
  }
  __stepIndex++
  if (__steps.length > __stepIndex && (report == undefined || report.messages == undefined || report.messages.length ==
      0)) {
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
  __ran = []
  __steps = steps;
  __checks = checks
  __endCallback = endCallback;
  __data = [];
  nextStep();
}