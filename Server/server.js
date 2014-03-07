var http = require("http");
var url = require("url");
var sys = require("sys");
var fs = require("fs");
var path = require('path');
var express = require('express');

var tool_path = __dirname + "/ClaferMoo/spl_datagenerator/";
var python_file_name = "IntegratedFeatureModelOptimizer.py";
var python = "python";


var port = 8080;

var server = express();

//support for sessions - not needed yet
server.use(express.cookieParser('asasdhf89adfhj0dfjask'));
var store = new express.session.MemoryStore;
server.use(express.session({secret: 'supersecretstring', store: store}));

server.use(express.static(__dirname + '/Client'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));

var URLs = [];
//&begin [urlUploading]
server.get('/', function(req, res) {
//uploads now and runs once app.html is fully loaded
//works because client currently sends one empty post upon completion of loading
	if (req.query.claferFileURL) {
		var sessionURL = new Object
		sessionURL.session = req.sessionID;
		sessionURL.url = req.query.claferFileURL;
		URLs.push(sessionURL);
		console.log(req.sessionID);
	}
    res.sendfile("Client/app.html");
});
//&end [urlUploading]

/*
 * Handle file upload
 */
server.post('/upload', function(req, res, next) {
	//check if client has either a file directly uploaded or a url location of a file
	//&begin [urlUploading]
   	if (req.files.claferFile === undefined){
   			for (var x=0; x <= URLs.length; x++){
   				if (x === URLs.length){
   					res.send("no clafer file submitted");
   					return;
   				} else if (URLs[x].session === req.sessionID && ("claferFileURL=" + URLs[x].url) === url.parse(req.body.claferFileURL).query){
   					var i = 0;
   					var uploadedFilePath = req.sessionID;
   					uploadedFilePath = uploadedFilePath.replace(/\\/g, "").replace('/', "");
   					uploadedFilePath = "./uploads/" + uploadedFilePath;
   					while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
   						i = i+1;
   					}
   					uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
					console.log("downloading file at " + URLs[x].url);
					var file = fs.createWriteStream(uploadedFilePath);
					http.get(URLs[x].url, function(res){
						res.on('data', function (data) {
							file.write(data);
						}).on('end', function(){
							file.end();
							console.log("file downloaded to ./uploads");
						});
					});
					URLs.splice(x,1);
					break;
   				}
   			}		
	} else {
		var uploadedFilePath = req.files.claferFile.path;
	}
  //&end [urlUploading]
	var file_contents;
	console.log("proceeding with " + uploadedFilePath);
    // read the contents of the uploaded file
	//&begin [timeout]
    //serverTimeout = setTimeout(function(){
    //	res.send ("Serverside Timeout.");
    //}, 60000);
	//&end [timeout]
	fs.readFile(uploadedFilePath, function (err, data) {
        file_contents = data.toString();
		
		console.log("processing file with integratedFMO");
		var util  = require('util'),
		spawn = require('child_process').spawn,
		tool  = spawn(python, [tool_path + python_file_name, uploadedFilePath, "--preservenames"]);
		var error_result = "";
		var data_result = "";
		
		tool.stdout.on('data', function (data) 
		{	
		  data_result += data;
		});

		tool.stderr.on('data', function (data) {
		  error_result += data;
		});

		tool.on('exit', function (code) 
		{
			var result = "";
			console.log("Preparing to send result");
			if(error_result.indexOf('Exception in thread "main"') > -1){
				code = 1;
			}
			if (code === 0) 
			{				
				result = "Return code = " + code + "\n" + data_result + "=====";
				var xml = fs.readFileSync(changeFileExt(uploadedFilePath, '.cfr', '_desugared.xml'));
				result += xml.toString();
				
				result = escapeHtml(result);
				
			}
			else 
			{
				result = 'Error, return code: ' + code + '\n' + error_result;
			}
			if (code === 0)
				res.writeHead(200, { "Content-Type": "text/html"});
			else
				res.writeHead(400, { "Content-Type": "text/html"});
			res.end(result);
//			clearTimeout(serverTimeout); //&line [timeout]
			cleanupOldFiles(uploadedFilePath);

		});
		
	});

});
//&begin [cleanOldFiles] 
function cleanupOldFiles(path) {

	//cleanup old files
	var ending = path.toLowerCase().substring(path.length - 4);
	console.log("Running Cleanup");
	if (fs.existsSync(path)){
		fs.unlink(path, function (err) {   //delete .cfr
  			if (err) throw err;
 			console.log("successfully deleted " + path);
		});
	}
	if (ending == ".cfr"){   //just added this because I realized people could kill the server with a bad file
		deleteOld(path, ".xml");
		deleteOld(path, "_desugared.cfr");
		deleteOld(path, "_desugared.xml");
		deleteOld(path, "_desugared.als");
		deleteOld(path, "_desugared.choco");
	}
//done cleanup
}

function deleteOld(path, ext){
	if (fs.existsSync(changeFileExt(path, '.cfr', ext))){
		fs.unlink(changeFileExt(path, '.cfr', ext), function (err) {   //delete .xml
			if (err) throw err;
 			console.log("successfully deleted " + changeFileExt(path, '.cfr', ext));
		});
	}
}
//&end [cleanOldFiles] 
function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function changeFileExt(name, ext, newExt)
{
	var ending = name.toLowerCase().substring(name.length - 4);
	if (ending == ext.toLowerCase())
		return name.substring(0, name.length - 4) + newExt;

	return name;
}

/*
 * Catch all error reporting for unknown routes
 */
server.use(function(req, res, next){
  res.send(404, 'Sorry cant find that!');
});

server.listen(port);
console.log('ClaferMooViz listening on port ' + port);
