#!/usr/bin/env node

/**
 * shooter.js This file is the entry point of the tool It loads the configuration and all the scenario and get the
 * associated steps
 */
console.log("==== REST Shooter ====")
fs = require("fs");
util = require('util');
runner = require('./runner.js');
logger = require('./logger.js');
os = require('os');

//NO default config, this globale variable to be accessed everywhere
__config = {
  baseUrl: '',
  port: 80,
  method: 'GET'
};
//The list of tests to run
var __testConfigs = [];
//The current index of the test to run
var __testIndex = -1;
//Hold the result of the tests to be
var __result = [];

function isFunction(object) {
  return (typeof object === 'function');
}

/**
 * This method propagate the configuration. This method is deprecated as we are using a globale variable (Stay until we
 * are sure that globale is better)
 *
 * @param {Object}
 *          cfg
 * @deprecated
 */
setUp = function(cfg, conffile) {
  logger.setContext(cfg);
  cfg.root = extractRootFolder(conffile);
  if (!isFunction(cfg.getSession)) {
    cfg.getSession = getSession;
  }
  if (!isFunction(cfg.setSession)) {
    cfg.setSession = setSession;
  }
  __config = cfg;
  logger.debug("--------------------");
  logger.debug("Server:" + __config.server);
  logger.debug("Scenario:" + __config.scenario);
  logger.debug("Report:" + __config.report);
  logger.debug("Root:" + __config.root);
  logger.debug("--------------------");
  runner.setContext(__config);
}

/**
 * Accept the header option of the request and the config for the current step it also receive the previous value of the session
 */
setSession = function(options, stepConfig, previousSession) {
  options.headers['Cookie'] += 'JSESSIONID=' + previousSession;
}

/**
* We are passing the data to let the use search into it or into the response
it must be returned to be shared accross the requests
*/
getSession = function(response,data) {
  console.log('STATUS: ' + response.statusCode);
  console.log('HEADERS: ' + JSON.stringify(response.headers));
  return "Ed_cx8lN4d13FwXeZQg5Iw";
}

/**
 * base on the file name this method returns the folder root
 */
extractRootFolder = function(file) {
  return file.substr(0, file.lastIndexOf(os.platform().indexOf("win32") > -1 || os.platform().indexOf("win64") > -1 ? "\\" : "/") + 1);
}

/*Callback once the test is done*/
/**
 * This method is called each time a test scenario ends it is not called on each step only at the end of the scenario to
 * move to the next one.
 *
 * @param {Object}
 *          ran is the result of the previous scenario run
 */
nextTest = function(ran) {
  if (ran) {
    //Store the result
    __result.push(ran);
    if(ran.messages && ran.messages.length){
      logger.error("Step "+ran.step.name+" failed for "+ran.messages[0]);
    }
  }
  __testIndex++;
  if (__testIndex < __testConfigs.length) {
    logger.debug("========================================================");
    logger.info("--> Run test [" + __testIndex + "]:" + __testConfigs[__testIndex].name);
    //Run the scenario with the common checks
    runner.run(__testConfigs[__testIndex].steps, __testConfigs[__testIndex].checks, nextTest);
  } else {
    logger.info("Writting report");
    logger.writeReport(__result);
  }
}

startTesting = function() {
  logger.info("Start testing");
  nextTest();
}

/**
 * This method loads all the step of a tests based on the configuration passed
 * @param {String} name
 * @param {Object} testCfg
 */
loadedTest = function(name, testCfg) {
  logger.debug("Scenario loaded:" + name);
  //Check the subtests
  for (var i = 0; i < testCfg.steps.length; i++) {
    if (typeof testCfg.steps[i] == 'string') {
      //Load step
      logger.debug("Loading step : " + testCfg.steps[i]);
      var data = fs.readFileSync(__config.root + testCfg.steps[i], 'utf-8');
      eval("var subTests=" + data);
      testCfg.steps[i] = subTests;
    }
  }
  __testConfigs.push(testCfg);
  if (__testConfigs.length == totalTest) {
    startTesting();
  }
}

/**
 * This method loads all the test listed in the parameter list
 * @param {Array} list of test to load
 */
loadTests = function(list) {
  totalTest = list.length;
  for (var i = 0; i < list.length; i++) {
    var fileName = list[i];
    logger.debug("Loading:" + __config.root + fileName);
    __loadTest(__config.root + fileName);
  }
}

/**
 * Asyncronous call to the load of the scenario
 * @param {String} fileName to be loaded
 */
__loadTest = function(fileName) {
  fs.readFile(fileName, 'utf-8', function(error, data) {
    if (error) {
      util.error(error);
      return;
    }
    eval("var testConfig=" + data);
    //Call the test loader to handle each steps
    loadedTest(fileName, testConfig);
  });
}

if (process.argv[2] == undefined) {
  console.log("You must pass the configuration");
  console.log("restshooter config.cfg");
} else {

  configfile = process.argv[2];
  logger.info("Runnning on: " + os.platform());
  logger.info("Reading config file: " + configfile);
  //Entry point of the program
  fs.readFile(configfile, 'utf-8', function(error, data) {
    if (error) {
      util.error(error);
      return;
    }
    eval("var cfg=" + data);
    setUp(cfg, configfile);
    loadTests(cfg.scenario);
  });
}