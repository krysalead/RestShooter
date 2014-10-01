RestShooter
===========

Rest Shooter is a node module able to take a list of scenario of URLs to call and check the response.
A Scenario is a list of steps, a step is a URL with parameter and checks (optional)


* Run POST and GET
* Check global field for a scenario
* Check specific field for a step
* Support only JSON for now
* Propagate the Session over the whole scenario
 
How to use it
=============

Installation
------------------
```bash
npm install -g restshooter
```


Configuration file
------------------
First we have to define the configuration, one per platform to target. Lets call it integration.cfg

```javascript
{
	"server":"localhost",
	"port":9091,
	"baseUrl":"/rest",
	"scenario":[
		"login.scn"
	],
	"sessionPath":'sessionId',
	"report":"myreport.log"
}
```

**server** is the server to target in our exemple it is localhost (no HTTP, no port, only server name)

**port** is the port to use to contact the server

**baseUrl** will be added in front of all URL to call (Usualy if you have a REST service on a dedicated path) you can leave blank

**scenario** is an array of scenario to run, files that will be loaded independently

**sessionPath** is the path in one of the JSON returned in the scenario that will give the session for the rest of the application (Will move to a Javascript function to make it more modular)

**Report** is the file where is report will be written at the end of the test

First Step
----------

You need to create file, by convention we will give it an '.stp' extension. The following exemple is for a login which must be reusable so it is the first one to create as a step. Lets call it login.stp.

```javascript
{
	name:"Login",
	url:"/login",
	method:"POST",
	content:"JSON",
	data:'{"login":"olivier",password:"mypass"}',
	checks:[{
		path:'response.answer',
		value:'ok'
	}]
}
```
**name** will be used in report and error to help investigation must be uniq per step.

**url** will be added to the base url previously presented in the configuration.

**method** is for now `POST` or `GET`.

**content** is the content type received.

**data** is the data object to be sent. Always a string, it will be used as it is in POST and will be escaped for GET.

**checks** is a list of checks to perform once the response is coming back from the server.

  * **path** is the path into the JSON returned to be checked (ie `{response:{answer:ok}}`).
  * **value** is expect value for the previous specicified node.
  * **test** this is a set of test for a node like exist or notempty separated by a `|`.

Here after the list of test:

| Name          | Behavior                                       |
| ------------- |------------------------------------------------|
| Exist         | Fail if the node is not existing in the answer |
| notempty      | Fail if the node is string empty or null       |


Second Step
----------

You need to create a file that represent the scenario. By convention we are using the '.scn' extension. Lets call it login.scn.

```javascript
{
	name:'Login',
	steps:[	
		"login.stp"
	],
	checks:[{
		path:'message',
		value:''
	},
	{
		path:'code',
		value:0
	}]
}
```
**name** is the identifier of the scenario for the report and the log in the console.

**steps** is the list of the steps to run for the scenario execution.

**checks** is the list of validation to perform on each request.

Run the script
--------------
```bash
shooter integration.cfg
```