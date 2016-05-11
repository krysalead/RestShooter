/**
 * logger.js This file contains all the method relative to the log into the application, debug and displayed message It
 * also contains the method to write the report
 */
var fs = require("fs");
var util = require('util');
var chalk = require('chalk');
var mkdirp = require('mkdirp');
var path = require('path');

var __context = {};
exports.setContext = function(context) {
  __context = context;
  if (__context.report && fs.existsSync(__context.report)) {
    //Remove the file create at the previous build
    fs.unlinkSync(__context.report);
  }
};

getTimeStamp = function() {
  var d = new Date();
  var ts = [];
  ts.push("[");
  ts.push(d.getFullYear());
  ts.push("-");
  ts.push(d.getMonth());
  ts.push("-");
  ts.push(d.getDate());
  ts.push("-");
  ts.push(d.getHours());
  ts.push(":");
  ts.push(d.getMinutes());
  ts.push(":");
  ts.push(d.getSeconds());
  ts.push("]");
  return ts.join("");
};

/**
 * Displayed only in debug mode
 *
 * @param {String}
 *          message
 * @param {Object}
 *          data
 */
exports.debug = function(message, data) {
  if (__context.debug) {
    console.log("[DEBUG]" + getTimeStamp() + " " + message);
    if (data != undefined) {
      //console.log("[DEBUG]"+getTimeStamp());
      console.info(data);
    }
  }
}

/**
 * Display always
 *
 * @param {String}
 *          message
 * @param {Object}
 *          data
 */
exports.info = function(message, data) {
  console.info(chalk.cyan("[INFO]" + getTimeStamp() + " " + message));
  if (data != undefined) {
    //console.info("[INFO]"+getTimeStamp());
    console.info(data);
  }
}

/**
 * Display always on stdrr
 *
 * @param {String}
 *          message
 * @param {Object}
 *          data
 */
exports.error = function(message, data) {
  console.error(chalk.red("[ERROR]" + getTimeStamp() + " " + message));
  if (data != undefined) {
    console.error(data);
  }
}

/**
 * Entrypoint to write a report
 *
 * @param {Array}
 *          result the result of the tests for each scenario and each step
 */
exports.writeReport = function(result) {
  var failed = getFailNumber(result);
  var __print = chalk.green;
  if (failed > 0) {
    __print = chalk.red;
  }
  console.log(__print("Scenario Run: " + result.length + " Failed: " + failed + " Passed: " + (result.length - failed) +
    " Total steps: " + getNumberOfSteps(result)));
  if (failed > 0) {
    print_messages(result);
  }
  if (__context.report) {
    writeLine("Report Generate at :" + new Date());
    writeLine("Test scenario ran: " + result.length);
    writeLine("Test step failed: " + getFailNumber(result));
    for (var i = 0; i < result.length; i++) {
      for (var j = 0; j < result[i].length; j++) {
        writeResult(result[i][j]);
      }
    }
  }
}

getNumberOfSteps = function(result) {
  var count = 0;
  for (var i = 0; i < result.length; i++) {
    count += result[i].length;
  }
  return count;
}

/**
 * Store in a file the data passed in parameter
 */
exports.store = function(data, file) {
  this.debug("Response data in: " + file);
  var p = file.split(path.sep);
  p.pop();
  mkdirp.sync(path.join.apply(path,p));
  fs.writeFileSync(file, data);
}

print_messages = function(result) {
  for (var i = 0; i < result.length; i++) {
    for (var j = 0; j < result[i].length; j++) {
      for (var k = 0; k < result[i][j].messages.length; k++) {
        exports.error(result[i][j].step.name + "-" + result[i][j].messages[k]);
      }
    }
  }
}

getFailNumber = function(result) {
  var count = 0;
  for (var i = 0; i < result.length; i++) {
    for (var j = 0; j < result[i].length; j++) {
      if (result[i][j].messages.length > 0) {
        count++;
      }
    }
  }
  return count;
}

writeResult = function(result) {
  writeLine(result.step.name);
  writeLine(JSON.stringify(result));
  if (result.messages.length > 0) {
    for (var i = 0; i < result.messages.length; i++) {
      writeLine(result.messages[i]);
    }
  } else {
    writeLine(result.step.url + " => Passed" + "[" + formatDuration(result.endedAt, result.startedAt) + "]");
  }
  writeLine("=============");
}

formatDuration = function(end, start) {
  var duration = end - start;
  second = Math.floor(duration / 1000);
  milisecond = duration - second * 1000;
  return second + "s" + milisecond + "ms"
}

writeLine = function(line) {
  if (__context.report) {
    if (fs.existsSync(__context.report)) {
      fs.appendFileSync(__context.report, line + "\n");
    } else {
      fs.writeFileSync(__context.report, line + "\n");
    }
  }
}