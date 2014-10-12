/**
 * logger.js This file contains all the method relative to the log into the application, debug and displayed message It
 * also contains the method to write the report
 */
fs = require("fs");
util = require('util');

var __context = {};
exports.setContext = function(context) {
  __context = context;
  if (__context.report && fs.existsSync(__context.report)) {
    //Remove the file create at the previous build
    fs.unlinkSync(__context.report);
  }
};

getTimeStamp = function(){
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
    console.log("[DEBUG]"+getTimeStamp()+" "+message);
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
  console.info("[INFO]"+getTimeStamp()+" "+message);
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
  util.error("[ERROR]"+getTimeStamp()+" "+message);
  if (data != undefined) {
    //util.error("[ERROR]"+getTimeStamp());
    util.error(data);
  }
}

/**
 * Entrypoint to write a report
 * 
 * @param {Array}
 *          result the result of the tests for each scenario and each step
 */
exports.writeReport = function(result) {
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
  writeLine("=============");
  for (var i = 0; i < result.messages.length; i++) {
    writeLine(result.messages[i]);
  }
  writeLine("=============");
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
