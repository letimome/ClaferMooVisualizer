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
//server.use(express.cookieParser('asasdhf89adfhj0dfjask'));
//server.use(express.session());

server.use(express.static(__dirname + '/Client'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));
//&begin [urlUploading]
server.get('/', function(req, res) {
//uploads now and runs once app.html is fully loaded
//works because client currently sends one empty post upon completion of loading
//!!!still has serious concurrency issues!!!
	if (req.query.claferFileURL){
		var uploadedFilePath = "./uploads/temporaryFile.cfr";
		console.log("downloading file at " + req.query.claferFileURL);
		var file = fs.createWriteStream(uploadedFilePath);
		http.get(req.query.claferFileURL, function(res){
			res.on('data', function (data) {
				file.write(data);
			}).on('end', function(){
				file.end();
				console.log("file downloaded to ./uploads");
			});
		});
	}
    res.sendfile("Client/app.html");
});
//&end [urlUploading]

/*
 * Handle file upload
 */
server.post('/upload', function(req, res, next) {
   	if (req.files.claferFile === undefined){
   			if (fs.existsSync("./uploads/temporaryFile.cfr")){
   				var uploadedFilePath = "./uploads/temporaryFile.cfr";
   			} else {
	   			res.send('no clafer file submitted');
				return;
   			}		
	} else {
		var uploadedFilePath = req.files.claferFile.path;
	}

	var file_contents;
	console.log("proceeding with " + uploadedFilePath);
    // read the contents of the uploaded file
	fs.readFile(uploadedFilePath, function (err, data) {
        file_contents = data.toString();
		
		console.log("processing file with integratedFMO");
		var util  = require('util'),
		spawn = require('child_process').spawn,
		tool  = spawn(python, [tool_path + python_file_name, uploadedFilePath]);
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
			console.log("Parsing alloy solution");
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
			res.writeHead(200, { "Content-Type": "text/html"});
			res.end(result);
			cleanupOldFiles(uploadedFilePath);

		});
		
	});

});
//&begin [cleanOldFiles] 
function cleanupOldFiles(path) {

	//cleanup old files
	var ending = path.toLowerCase().substring(path.length - 4);
	console.log("Running Cleanup");
	fs.unlink(path, function (err) {   //delete .cfr
  	if (err) throw err;
 		console.log("successfully deleted " + path);
	});
	if (ending == ".cfr"){   //just added this because I realized people could kill the server with a bad file
		fs.unlink(changeFileExt(path, '.cfr', '.xml'), function (err) {   //delete .xml
	  		if (err) throw err;
 			console.log("successfully deleted " + changeFileExt(path, '.cfr', '.xml'));
		});
		fs.unlink(changeFileExt(path, '.cfr', '_desugared.xml'), function (err) {   //delete _desugared.xml
			if (err) throw err;
			console.log("successfully deleted " + changeFileExt(path, '.cfr', '_desugared.xml'));
		});
		fs.unlink(changeFileExt(path, '.cfr', '_desugared.als'), function (err) {    //delete _desugared.als
			if (err) throw err;
			console.log("successfully deleted " + changeFileExt(path, '.cfr', '_desugared.als'));
		});
		fs.unlink(changeFileExt(path, '.cfr', '_desugared.cfr'), function (err) {    //delete _desugared.cfr
			if (err) throw err;
			console.log("successfully deleted " + changeFileExt(path, '.cfr', '_desugared.cfr'));
		});
		fs.unlink(changeFileExt(path, '.cfr', '_desugared.choco'), function (err) {    //delete _desugared.choco
			if (err) throw err;
			console.log("successfully deleted " + changeFileExt(path, '.cfr', '_desugared.choco'));
		});
	}
//done cleanup
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
