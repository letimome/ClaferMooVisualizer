/*
Copyright (C) 2012, 2013 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
function Input(host)
{ 
    this.id = "mdInput";
    this.title = "Input";

    this.requestTimeout = 60000; // what is the timeout for response after sending a file, &line timeout
    this.pollingTimeout = 60000;  // what is the timeout when polling, &line [polling, timeout]
    this.pollingDelay = 2000;    // how often to send requests (poll) for updates, &line polling


    this.width = 500;
    this.height = 30;
    this.posx = 0;
    this.posy = 0;
    
    this.pollingTimeoutObject = null;//&line [polling, timeout]
    this.toCancel = false;//&line cancellation
    
    this.host = host;
    this.serverAction = "/upload";
}

Input.method("onDataLoaded", function(data){
    this.processor = new ClaferProcessor(data.claferXML);
    this.goals = this.processor.getGoals();
});

Input.method("onInitRendered", function()
{
    this.optimizeFlag = 1;
    this.addInstancesFlag = 1;
    this.previousData = "";
    this.toCancel = false;//&line cancellation

    $("#optimize").click(this.OptimizeCall.bind(this));
    $("#addInstances").click(this.addInstancesCall.bind(this));
    $("#myform [type='file']").change(this.inputChange.bind(this));
    
    $("#optimize").attr("disabled", "disabled");
    $("#addInstances").attr("disabled", "disabled");
 
    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.fileSent.bind(this);//&line polling
    options.error = this.handleError.bind(this);
    options.timeout = this.requestTimeout;// &line timeout

    $('#myform').ajaxForm(options); 
	$('#myform').submit();
});

/*
 * Cancel request
 */
//$begin cancellation
Input.method("cancelCall", function() 
{
    $("#cancel").hide();
    $("#status_label").html("Cancelling...");
    this.toCancel = true;
});
//$end cancellation
/*
 * Shows uploader and hides the form
*/
Input.method("beginQuery", function(formData, jqForm, options) {
	$("#load_area #myform").hide();
	$("#load_area").append('<div id="preloader"><img id="preloader_img" src="/images/preloader.gif" alt="Loading..."/><span id="status_label">Loading and processing...</span><button id="cancel">Cancel</button></div>');	
    $("#cancel").click(this.cancelCall.bind(this));//&line cancellation
    return true; 
});

// post-submit callback 
Input.method("endQuery", function()  { 
	$("#preloader").remove();
	$("#load_area #myform").show();
	
	return true;
});

/* Not used. We don't need it anymore
// pre-submit callback 
Input.method("showRequest", function(formData, jqForm, options) {
    var queryString = $.param(formData); 
    return true; 
});
*/

//&begin polling
Input.method("onPoll", function(response)
{
    if (response === "Working")
    {
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);//&line timeout
    }//&begin cancellation
    else if (response === "Cancelled")
    {
        this.endQuery();
    }//&end cancellation
    else
    {
        this.processToolResult(response);
        this.endQuery();
    }
});        

Input.method("poll", function()
{
    var options = new Object();
    options.url = "/poll";
    options.type = "post";
    options.timeout = this.pollingTimeout;//&line timeout
    if (!this.toCancel)
        options.data = {windowKey: this.host.key, command: "ping"};
    else
        options.data = {windowKey: this.host.key, command: "cancel"};//&line cancellation
    
    options.success = this.onPoll.bind(this);
    options.error = this.handleError.bind(this);
    
    $.ajax(options);
});

Input.method("fileSent", function(responseText, statusText, xhr, $form)  { 
    this.toCancel = false;
    if (responseText.indexOf("no clafer file submitted") == -1)
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
    else
        this.endQuery();
});
//&end polling
//&begin errorHandling
Input.method("handleError", function(response, statusText, xhr)  { 
	clearTimeout(this.pollingTimeoutObject);
	var er = document.getElementById("error_overlay");
	er.style.visibility = "visible";	
    var caption;
    
    if (statusText == "timeout")//&line timeout
        caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";//&line timeout
    else if (statusText == "malformed_output")
        caption = "<b>Malformed output received from ClaferMoo.</b><br>Please check whether you are using the correct version of ClaferMoo. Also, an unhandled exception is possible.  Please verify your input file: check syntax and integer ranges.";        
    else if (statusText == "malformed_instance")
        caption = "<b>Malformed instance data received from ClaferMoo.</b><br>An unhandled exception may have occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.";        
    else if (statusText == "empty_instances")
        caption = "<b>No instances returned.</b>Possible reasons:<br><ul><li>No optimal instances, all variants are non-optimal.</li><li>An unhandled exception occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.</li></ul>.";        
    else if (statusText == "empty_argument")
        caption = "<b>Empty argument given to processToolResult.</b><br>Please report this error.";        
    else if (statusText == "error" && response.responseText == "")
        caption = "<b>Request Error.</b><br>Please check whether the server is available.";        
    else
        caption = '<b>' + xhr + '</b><br>' + response.responseText.replace("\n", "<br>");
    
	document.getElementById("error_report").innerHTML = ('<span id="close_error" alt="close">Close Message</span><p>' + caption + "</p>");
	document.getElementById("close_error").onclick = function(){ 
		document.getElementById("error_overlay").style.visibility = "hidden";
	};
	this.endQuery();
    
});
//&end errorHandling
Input.method("convertHtmlTags", function(input) {
  var in_tag=false;
  var in_var=false;
  var output = new String("");

  var length = input.length;
  
  for (var i=0; i< length; i++) 
    {
      ch = input.charAt(i);
	  
      if (in_tag) 
	  {
		if (in_var) 
		{
			if (ch == '"') 
			{
				in_var = false;
			}
			
			output += ch;
		}
		else 
		{
			if (ch == '"') 
			{
				in_var = true;
			}
			else if (ch == '>') 
			{
				in_tag = false;
			}
			
			output += ch.toLowerCase();
		}
      }
      else 
	  {
		if (ch == '<') 
		{
			in_tag = true;
		}
		output += ch;
      }
    }

  return output;
});

Input.method("OptimizeCall", function(){
   	this.optimizeFlag = 1;
   	this.addInstancesFlag = 0;
   	this.previousData = "";
   	host.findModule("mdComparisonTable").permaHidden = {};
});

Input.method("addInstancesCall", function(){
   	this.optimizeFlag = 0;
   	this.addInstancesFlag = 1;
});

Input.method("inputChange", function(){
	var filename = $("#myform [type='file']").val();
	if (filename.substring(filename.length-4) == ".cfr"){
		$("#optimize").removeAttr("disabled");
		$("#addInstances").attr("disabled", "disabled");
	} else if (filename.substring(filename.length-5) == ".data"){
		$("#optimize").attr("disabled", "disabled");
		$("#addInstances").removeAttr("disabled");
	}
});
//&begin instanceProcessing
Input.method("processToolResult", function(result)
{//&begin errorHandling
	if (!result)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }
        //&end errorHandling
	var ar = [];

	if (this.optimizeFlag){
		ar = result.split("=====");
		this.optimizeFlag = 0;
    	this.addInstancesFlag = 0;
    	//&begin errorHandling
    	if (ar.length != 3)
		{
            this.handleError(null, "malformed_output", null);
       		return;
   		}//&end errorHandling
    } else if (this.addInstancesFlag) {
		ar = this.previousData.Unparsed;
		this.optimizeFlag = 0;
    	this.addInstancesFlag = 0;
    	//&begin errorHandling
		if (ar == null || ar.length != 3)
		{
            this.handleError(null, "malformed_output", null);
       		return;
   		}//&end errorHandling

		var parser = new InstanceConverter(result)
		ar[1] += parser.convertFromClaferIGOutputToClaferMoo(this.previousData.abstractXML);
	}

	var instancesXMLText = (new InstanceConverter(ar[1])).convertFromClaferMooOutputToXML();
	var abstractXMLText = ar[2];

	instancesXMLText = instancesXMLText.replaceAll('<?xml version="1.0"?>', '');
	//&begin errorHandling
    if (instancesXMLText.length == 0 || instancesXMLText == "<instances></instances>")
    {
        this.handleError(null, "empty_instances", null);
        return;
    }//&end errorHandling
    //&begin errorHandling
    if (instancesXMLText.indexOf("<instance></instance>") >= 0)
	{
        this.handleError(null, "malformed_instance", null);
        return;
    }//&end errorHandling
   
	abstractXMLText = abstractXMLText.replaceAll("&quot;", "\"");
	abstractXMLText = abstractXMLText.replaceAll("&gt;", ">");
	abstractXMLText = abstractXMLText.replaceAll("&lt;", "<");
	abstractXMLText = abstractXMLText.replaceAll("&amp;", "&");
	
	abstractXMLText = this.convertHtmlTags(abstractXMLText);
		
	// clean namespaces
	abstractXMLText = abstractXMLText.replaceAll('<?xml version="1.0"?>', '');
	abstractXMLText = abstractXMLText.replaceAll(' xmlns="http://clafer.org/ir" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:cl="http://clafer.org/ir" xsi:schemalocation="http://clafer.org/ir https://github.com/gsdlab/clafer/blob/master/src/ClaferIR.xsd"', '');
	abstractXMLText = abstractXMLText.replaceAll('cl:', '');
	abstractXMLText = abstractXMLText.replaceAll('xsi:', '');

    var data = new Object();
    data.error = false;
    data.output = ar[0];
    data.instancesXML = instancesXMLText;
    data.claferXML = abstractXMLText;
    if (this.previousData == ""){
    	var lines = ar[1].match(/^.*([\n\r]+|$)/gm);
    	lines = ar[1].split(lines[1]);
    	this.originalPoints = lines.length - 1;
    }
    data.originalPoints = this.originalPoints;
    this.previousData = { Unparsed: ar, abstractXML: data.claferXML };
    this.host.updateData(data);
});//&end instanceProcessing
Input.method("getInitContent", function()
{
	return '<div id="load_area"><form id="myform" action="' + this.serverAction + '" method="post" enctype="multipart/form-data">' + '<input type="file" size="15" name="claferFile">' + '<input type="hidden" name="claferFileURL" value="' + window.location + '">' + '<input id="optimize" type="submit" value="Optimize">'+
    '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">' + //&line windowKey
    '<input id="addInstances" type="submit" value="Add Instances">' + '</form></div>';  
});