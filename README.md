RestShooter
===========

Rest Shooter is a node module able to take a list of scenario of URLs to call and check the response.
A Scenario is a list of steps, a step is a URL with parameter and checks (optional)


* Run HTTP and HTTPS
* Run POST,GET,DELETE,PUT
* Check global field for a scenario
* Check specific field for a step
* Support only JSON and XML
* Allows to propagate a session along a scenario
* Allows to hook on request

By default Session is retrieved from the cookie and store in the cookie as:
* JSESSIONID (J2EE)
* PHPSESSID (PHP)

(Contact me if you want me to put other default id)

How to use it
=============

Installation
------------------
```bash
npm install -g restshooter
```

Sample Project
------------------

Checkout the sample folder. You can run from this folder
```bash
restshooter weather.cfg
```


Configuration file
------------------
First we have to define the configuration, one per platform to target. Lets call it integration.cfg

```javascript
{
	"server":"localhost",
	"port":9091,
	"baseUrl":"/rest",
	"protocol":"https",
	"scenario":[
		"login.scn"
	],
	"content":"JSON",
	"getSession":function(response,data,stepConfig){},
	"setSession":function(requestOptions,stepConfig,previousSession){},
	"preRequest":function(requestOptions,stepConfig){},
	"postRequest":function(response,data,stepConfig){},
	"report":"myreport.log",
	"parseInput":function(data,stepConfig){},
	"debug":true
}
```

**server** is the server to target in our exemple it is localhost (no HTTP, no port, only server name)

**port** is the port to use to contact the server

**baseUrl** will be added in front of all URL to call (Usualy if you have a REST service on a dedicated path) you can leave blank

**scenario** is an array of scenario to run, files that will be loaded independently

**getSession** (optional) JavaScript function that allows to extract the session from the server response, it receive the data and the [response](http://nodejs.org/api/http.html#http_http_incomingmessage)

**setSession** JavaScript function that allows to set the session in the header request options (Cookie), the step config (URL parameter for instance) and also the previous session so it can be propagated

**preRequest** (optional) JavaScript function that allows to performe some changed in the request options before sending.

requestOptions Object:

```javascript
{
    hostname:
    port:
    path:
    method:
    headers: {}
}
```

**postRequest** (optional) JavaScript function that allows to clean up the response data or parse it if needed. It should returned a cleaned JSON version of the data.

**Report** is the file where is report will be written at the end of the test

**debug** (optional) If set to true it will output more information on the console.

**content** is the content type received.

**protocol** Use this property to target your server in HTTP or HTTPS, becareful to use the right port (see know issue section)

**parseInput** function that will format the input parameter of a step into a JSON, this will allow to reuse the input parameter across all the steps with the following syntax

```
&q=${in.ByCity.q}
```

First Step
----------

You need to create file, by convention we will give it an '.stp' extension. The following exemple is for a login which must be reusable so it is the first one to create as a step. Lets call it login.stp.

```javascript
{
	"name":"Login",
	"url":"/login",
	"method":"POST",
	"data":"{\"login\":\"olivier\",\"password\":\"mypass\"}",
	"checks":[{
		"path":"response.answer",
		"test":"exist|ok"
	}]
}
```
**name** will be used in report and error to help investigation must be unique per step.

**url** will be added to the base url previously presented in the configuration.

**method** is for now `POST` or `GET`.

**extend** is a string to another steps to inherit from (ie: extend:'basicstep.stp').

**data** is the data object to be sent. Always a string, it will be used as it is in POST and will be escaped for GET.

**checks** is a list of checks to perform once the response is coming back from the server.

  * **path** is the path into the JSON returned to be checked (ie `{response:{answer:ok}}`).
  * **test** this is a set of test for a node like exist or notempty separated by a `|`.

**preRequest** can be setup at step level and will have the same signature as the global one, it will be called after the global.

**postRequest** can be setup at step level and will have the same signature as the global one, it will be called after the global but will have the priority to the global.

**getSession** can be setup at step level and will have the same signature as the global one, it will be called after the global but will have the priority to the global.

**setSession** can be setup at step level and will have the same signature as the global one, it will be called after the global.

Here after the list of test:

| Name          | Behavior                                                                                                       |
| ------------- |----------------------------------------------------------------------------------------------------------------|
| notexist      | Fail if the node is existing in the answer                                                                     |
| exist         | Fail if the node is not existing in the answer                                                                 |
| existnotnull  | Fail if the node is existing but null                                                                          |
| notempty      | Fail if the node is string empty or null                                                                       |
| empty         | Fail if the node is string not empty                                                                           |
| struct        | Fail if the json response is not structurly the same as the reference (path contains the path to the reference)|
| default       | All value not listed above will be value comparison                                                            |


Second Step
----------

You need to create a file that represent the scenario. By convention we are using the '.scn' extension. Lets call it login.scn.

```javascript
{
	"name":"Login",
	"steps":[
		"login.stp"
	],
	"checks":[{
		"path":"message",
		"test":""
	},
	{
		"path":"code",
		"test":0
	}]
}
```
**name** is the identifier of the scenario for the report and the log in the console.

**steps** is the list of the steps to run for the scenario execution.

**checks** is the list of validation to perform on each request.

Run the script
--------------
```bash
restshooter integration.cfg
```

Variable Replacement
---------------
The idea is to take something from the response and to inject into the next request

Imagine that the previous step was the login (name:'login' in the step configuration file) and the answer was something like
```javascript
{
	"user":{
		"name":'Olivier',
		"ref":1234567
	}
}
```
Then in the payload of the next step, lets call it getPreference, I can write something like

```javascript
...
"data":"/${login.user.ref}/"
...
```

getting a value in an list of value

```javascript
...
"data":"/${login.preferences[0].ref}/"
...
```

So the system will replace the variable by the value from the previous request and we will get the parameter of the logged user.

**${}** is the syntax for the replacement

**login** is the name of the step

**user.ref** is the path to the variable in the JSON returned by the previous script

Hooks
--------------

You can add hooks preRequest and postRequest that last will override the default parsing so you must do a parsing in addition to other code.
You can also do some reference to libraries, you just have to install them in your node modules folder with npm and then accession like that
```javascript
...
"preRequest":function(){
	var btoa = require(process.cwd()+'/node_modules/btoa/index.js');
	console.log(btoa("Pre Request Processing"));
}
```
Note that you can install globally and it will work using simply __require('btoa');__

Unit test
--------------

```bash
karma start karma.conf.js
```

Known Issues
--------------

On OSX we have to link node installation as it is in linux system.

```bash
sudo ln -s /usr/local/bin/node /usr/bin/node
```

You can get this error : SSL routines:SSL23_GET_SERVER_HELLO:unknown protocol
Check that you specify the right port (443 instead of 80)