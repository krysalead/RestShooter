var underTest = require('../src/logger.js');

describe("logger", function() {
  it("do not log debug if not activated", function() {
    spyOn(console,"log");
    underTest.setContext({debug:false});
    underTest.debug("My message")
    expect(console.log).not.toHaveBeenCalled();
  });
  it("do a log if debug is activated", function() {
    spyOn(console,"log");
    underTest.setContext({debug:true});
    underTest.debug("My message")
    expect(console.log).toHaveBeenCalled();
  });
});