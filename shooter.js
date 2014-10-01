/**
 * shooter.js This file is the entry point of the tool It loads the configuration and all the scenario and get the
 * associated steps
 */
console.log("==== REST Shooter ====")
fs = require("fs");
util = require('util');
runner = require('./runner.js');
logger = require('./logger.js');

//NO default config, this globale variable to be accessed everywhere
__config = {
  baseUrl : '',
  port : 80,
  method : 'GET'
};
//The list of tests to run
var __testConfigs = [];
//The current index of the test to run
var __testIndex = -1;
//Hold the result of the tests to be
var __result = [];

/**
 * This method propagate the configuration. This method is deprecated as we are using a globale variable (Stay until we
 * are sure that globale is better)
 * 
 * @param {Object}
 *          cfg
 * @deprecated
 */
setUp = function(cfg) {
  __config = cfg;
  logger.debug("--------------------");
  logger.debug("Server:" + __config.server);
  logger.debug("Scenario:" + __config.scenario);
  logger.debug("Report:" + __config.report);
  logger.debug("--------------------");
  runner.setContext(__config);
  logger.setContext(__config);
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
  console.log("Start testing");
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
      var data = fs.readFileSync(testCfg.steps[i], 'utf-8');
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
    __loadTest(fileName);
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

logger.info("Reading config file : " + process.argv[2]);
//Entry point of the program
fs.readFile(process.argv[2], 'utf-8', function(error, data) {
      if (error) {
        util.error(error);
        return;
      }
      eval("var cfg=" + data);
      setUp(cfg);
      loadTests(cfg.scenario);
    });
