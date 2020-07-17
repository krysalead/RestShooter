var underTest = require('../src/checker.js');
var fileReader = require('../tools/filereader.js');

underTest.setContext({
  debug:true
});

describe("checker", function() {
  describe("getJsonNode", function(){
    var buildJSON = function(){
      return {
        a:{
          b:[{
            c:"test0c"
          },
          {
            c:"test1c"
          }],
          d:"testd"
        }
      }
    }
    it("returns a node when existing", function() {
      expect(underTest.getJsonNode("a.d",buildJSON())).toBe("testd");
    });
    it("returns a node when existing in an array", function() {
      expect(underTest.getJsonNode("a.b[0].c",buildJSON())).toBe("test0c");
    });
    it("returns undefined when not existing in an array", function() {
      expect(underTest.getJsonNode("a.b[2].c",buildJSON())).toBe(undefined);
    });
    it("returns undefined when not existing", function() {
      expect(underTest.getJsonNode("a.c",buildJSON())).toBe(undefined);
    });
    it("returns undefined when not existing and path is a system path", function() {
      expect(underTest.getJsonNode("../../test/test.json",buildJSON())).toBe(undefined);
    });
  })
  describe("checkResponse", function(){
    it("it can compare 2 jsons and there is no difference in the stucture", function() {
      var response = fileReader.readMock("ref/bycity.json");
      var fakeResponse = JSON.parse(response);
      fakeResponse.base = "radar"
      spyOn(underTest,'getJsonFromFile').and.returnValue(fakeResponse);
      eval("var step = "+fileReader.readMock("paris/bycity.stp"));
      expect(underTest.checkResponse(JSON.parse(response),step.checks).length).toBe(0);
    });
    it("it can compare 2 jsons and there are differences in the stucture", function() {
      var response = fileReader.readMock("ref/bycity.json");
      var fakeResponse = JSON.parse(response);
      delete fakeResponse.base
      spyOn(underTest,'getJsonFromFile').and.returnValue(fakeResponse);
      eval("var step = "+fileReader.readMock("paris/bycity.stp"));
      expect(underTest.checkResponse(JSON.parse(response),step.checks).length).toBe(1);
    });
  });
});