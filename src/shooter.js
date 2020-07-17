  #!/usr/bin/env node

  /**
   * shooter.js This file is the entry point of the tool It loads the configuration and all the scenario and get the
   * associated steps
   */
  console.log('==== REST Shooter ====');
  var fs = require('fs');
  var path = require('path');
  var _ = require('lodash');
  var runner = require('./runner.js');
  var logger = require('./logger.js');
  var xmlParser = require('xml2js').parseString;
  os = require('os');

  //NO default config, this globale variable to be accessed everywhere
  __config = {
    baseUrl: '',
    port: 80,
    protocol: 'http',
    method: 'GET'
  };
  //The list of tests to run
  var __testConfigs = [];
  //The current index of the test to run
  var __testIndex = -1;
  //Hold the result of the tests to be
  var __result = [];

  /**
   * Determine if the passed object is a function
   * @param object
   * @returns {boolean}
   */
  function isFunction(object) {
    return typeof object === 'function';
  }

  /**
   * This method propagate the configuration. This method is deprecated as we are using a globale variable (Stay until we
   * are sure that globale is better)
   *
   * @param {Object}
   *          cfg
   * @deprecated
   */
  var setUp = function (cfg, confFile) {
    logger.setContext(cfg);
    cfg.root = extractRootFolder(confFile);
    if (!isFunction(cfg.getSession)) {
      logger.debug('Defaulting the getSession value was :' + cfg.getSession);
      cfg.getSession = getSession;
    }
    if (!isFunction(cfg.setSession)) {
      logger.debug('Defaulting the setSession value was :' + cfg.setSession);
      cfg.setSession = setSession;
    }
    if (!isFunction(cfg.postRequest)) {
      logger.debug('Defaulting the postRequest value was :' + cfg.postRequest);
      var content = cfg.content ? cfg.content : '';
      switch (content.toUpperCase()) {
        case 'JSON':
          cfg.postRequest = parseJson;
          break;
        case 'XML':
          cfg.postRequest = parseXML;
          break;
        default:
          throw 'Unsupported format, please provide content type configuration [JSON,XML] or a postRequest hook';
      }
    }
    if (!isFunction(cfg.preRequest)) {
      logger.debug('Defaulting the preRequest value was :' + cfg.preRequest);
      cfg.preRequest = function () {};
    }
    if (!isFunction(cfg.parseInput)) {
      logger.debug('Defaulting the parseInput value was :' + cfg.parseInput);
      cfg.parseInput = function (data, config) {
        if (!data) {
          return "";
        }
        if (config.method == undefined || config.method.toUpperCase() == 'GET') {
          return fromQueryToJson(data);
        } else {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error("Fail to parse", e, data);
            return {};
          }
        }
      };
    }

    __config = _.merge(__config, cfg);
    logger.debug('--------------------');
    logger.debug('Running on: ' + os.platform() + '-' + path.sep);
    logger.debug('Server:' + __config.server);
    logger.debug('Scenario:' + __config.scenario);
    logger.debug('Report:' + __config.report);
    logger.debug('Root:' + __config.root);
    logger.debug('--------------------');
    runner.setContext(__config);
  };

  var fromQueryToJson = function (data) {
    var o = {};
    if (data) {
      var values = data.split('&');

      for (var i = 0; i < values.length; i++) {
        var kv = values[i].split('=');
        o[kv[0]] = kv[1];
      }
    }
    return o;
  };

  /**
   * Default function for parsing JSON response
   * @param {String} data raw data from the server
   * @param {Object} server_response the response from the server
   */
  var parseJson = function (data, server_response) {
    logger.debug('Automatic JSON parsing');
    return JSON.parse(data.replace(/\t|\n|\r/g, ''));
  };

  /**
   * Default function for parsing XML response
   * @param {String} data raw data from the server
   * @param {Object} server_response HTTP response from the server
   * @param {Function} callback as it is asyncrhonous
   */
  var parseXML = function (data, server_response, callback) {
    logger.debug('Automatic XML parsing');
    xmlParser(data, function (err, result) {
      callback.call({
        data: result,
        getnode: checker.getJsonNode
      });
    });
  };

  /**
   * Accept the header option of the request and the config for the current step it also receive the previous value of the session
   */
  setSession = function (options, stepConfig, previousSession) {
    options.headers['Cookie'] = options.headers['Cookie'] ?
      options.headers['Cookie'] : [];
    options.headers['Cookie']['JSESSIONID'] = previousSession;
    options.headers['Cookie']['PHPSESSID'] = previousSession;
  };

  /**
  * We are passing the data to let the user search into it or into the response
  it must be returned to be shared accross the requests
  */
  getSession = function (response, data) {
    var cookies = response.headers['Cookie'] ?
      response.headers['Cookie'] ?
      response.headers['Cookie'] :
      response.headers['Set-Cookie'] : [];
    var session = cookies['PHPSESSID'] ?
      cookies['PHPSESSID'] :
      cookies['JSESSIONID'] ?
      cookies['JSESSIONID'] :
      '';
    return session;
  };

  /**
   * base on the file name this method returns the folder root
   */
  extractRootFolder = function (file) {
    var pos =
      file.lastIndexOf('/') != -1 ?
      file.lastIndexOf('/') :
      file.lastIndexOf('\\');
    return file.substr(0, pos);
  };

  /*Callback once the test is done*/
  /**
   * This method is called each time a test scenario ends it is not called on each step only at the end of the scenario to
   * move to the next one.
   *
   * @param {Object}
   *          ran is the result of the previous scenario run
   */
  nextTest = function (ran) {
    __testIndex++;
    if (__testIndex < __testConfigs.length) {
      logger.debug('========================================================');
      logger.info(
        '--> Run test [' + __testIndex + ']:' + __testConfigs[__testIndex].name
      );
      var promise;
      if (__config.preRun) {
        promise = __config.preRun(__testConfigs[__testIndex]);
      }
      //Run the scenario with the common checks
      if (!promise.then) {
        promise = new Promise.resolve({});
      }
      promise.then(
        (data) => {
          runner.run(
            __testConfigs[__testIndex].steps,
            __testConfigs[__testIndex].checks,
            storeResultAndRunNext,
            data
          );
        },
        reason => {
          logger.error('Fails to call the preRun hook for: ' + reason);
          nextTest();
        }
      );
    } else {
      logger.info('Writting report');
      logger.writeReport(__result);
      __result = [];
    }
  };

  storeResultAndRunNext = function (ran) {
    //Store the result
    __result.push(ran);
    if (ran.messages && ran.messages.length) {
      logger.error('Step ' + ran.step.name + ' failed for ' + ran.messages[0]);
    } else {
      var promise;
      if (__config.postRun) {
        promise = __config.postRun(ran);
      }
      if (!promise.then) {
        promise = new Promise.resolve();
      }
      promise.then(
        () => {
          nextTest();
        },
        reason => {
          logger.error('Fails to call the postRun hook for: ' + reason);
        }
      );
    }
  };

  startTesting = function () {
    logger.info('Start testing');
    nextTest();
  };

  /**
   * This method loads all the step of a tests based on the configuration passed
   * @param {String} name
   * @param {Object} testCfg
   */
  loadedTest = function (name, testCfg) {
    var root = extractRootFolder(name) + path.sep;
    logger.debug('Scenario loaded:' + name);
    //Check the subtests
    for (var i = 0; i < testCfg.steps.length; i++) {
      if (typeof testCfg.steps[i] == 'string') {
        //Load step
        logger.debug('Loading step : ' + testCfg.steps[i]);
        var data = fs.readFileSync(root + testCfg.steps[i], 'utf-8');
        eval('var subTests=' + data);
        //Extend a test with another one
        if (subTests.extend) {
          var o = {};
          _.assign(o, getParentTest(subTests.extend, root), subTests);
          subTests = o;
        }
        testCfg.steps[i] = subTests;
      } else {
        logger.debug('Registered step : ' + testCfg.steps[i].name);
      }
    }

    __testConfigs.push(testCfg);
    if (__testConfigs.length == totalTest) {
      startTesting();
    }
  };

  /**
   * Return the configuration of a parent test
   * @param {String} path of the parent test
   * @param {String} root to load the parent test
   */
  getParentTest = function (name, root) {
    if (!_.endsWith('.stp')) {
      name += '.stp';
    }
    return JSON.parse(fs.readFileSync(root + name, 'utf-8'));
  };

  /**
   * This method loads all the test listed in the parameter list
   * @param {Array} list of test to load
   */
  loadTests = function (list) {
    totalTest = list.length;
    for (var i = 0; i < list.length; i++) {
      var fileName = list[i];
      logger.debug('Loading:' + __config.root + fileName);
      __loadTest(__config.root + fileName);
    }
  };

  /**
   * Asyncronous call to the load of the scenario
   * @param {String} fileName to be loaded
   */
  __loadTest = function (fileName) {
    fs.readFile(fileName, 'utf-8', function (error, data) {
      if (error) {
        logger.error(error);
        return;
      }
      eval('var testConfig=' + data);
      //Call the test loader to handle each steps
      loadedTest(fileName, testConfig);
    });
  };

  if (process.argv[2] == undefined) {
    logger.error('You must pass the configuration');
    logger.error('restshooter config.cfg');
  } else {
    configfile = process.argv[2];
    logger.info('Reading config file: ' + configfile);
    var cfg = require(path.join(process.cwd(), configfile));
    //Entry point of the program
    setUp(cfg, configfile);
    loadTests(cfg.scenario);
  }