var readMockBase = '/base/sample/';
/**
 * Read sycnrhonously a file on the server
 * Return the answer without any processing
 */
var readFile = function(url) {

  var xhr = new XMLHttpRequest();
  var data = null;

  xhr.open("GET", url, false);

  xhr.onload = function(e) {
    if (xhr.status === 200) {
      data = xhr.responseText;
    } else {
      console.error('readFile', url, xhr.statusText);
    }
  };

  xhr.onerror = function(e) {
    console.error('readFile', url, xhr.statusText);
  };

  xhr.send(null);
  return data;
};

/**
 * read the mock file in the mock folder
 */
exports.readMock = function(url) {
  url = readMockBase + url;
  return readFile(url);
};