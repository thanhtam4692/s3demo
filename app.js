
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var knox = require('knox');
var multiparty = require('multiparty');
var crypto = require('crypto');
var graphicsmagick = require('gm');
var gm = graphicsmagick.subClass({ imageMagick: true });
var jwt = require('jwt-simple');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

var s3Client = knox.createClient({
	secure: false,
	key: "AKIAIXPNMT6OOY4SS62A",
	secret: "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",
	bucket: "jornee"
});

app.post('/upload_avatar', function(req, res) {
	var form = new multiparty.Form();

	form.on('error', function(err){
		if(err){
			console.log("Upload with error: " + err);
		}
		res.send({ authen_status: 'ok', status: 'error' });
	});

	form.on('part', function(part){
		var type = part.headers['content-type'];
		if(type){
			type = type.split('/');
			type = type[1];
			if(type != 'jpeg' && type != 'png' && type != 'jpg')
			{
				this.emit('error');
			}
		}
	});

	form.on('file', function(name, file){
		//console.log("file: " + name + " " + file.headers);
	});

	form.on('field', function(name, value){
		//console.log("field: " + name + " " + value);
	});

	form.parse(req, function(err, fields, files) {
		var request = {};
		request.body = {};
		var file  = files.upload[0];
		var type = file.headers['content-type'];
		type = type.split('/');
		type = type[1];
		if(type == 'jpeg'){
			type = 'jpg';
		}
		var algorithm = 'aes256'; // or any other algorithm supported by OpenSSL
		var key = 'tam';
		var text = 'tamtt';
		var info = {
			date: new Date()
		};
		var cipher = crypto.createCipher(algorithm, key);
		var filename = cipher.update(text, 'utf8', 'hex') + cipher.final('hex') + "_" + jwt.encode(info, key);
		var headers = {
			'x-amz-acl': 'public-read'
		};
		headers['Content-Length'] = files.upload[0].size;
		s3Client.putFile(file.path, '/images/original/'+ filename + '.' +type, function(err, s3Response) {
			if (err) throw err;
		});
		//Resize
		var img = gm(file.path);
		img.resize(666);
		img.write('./tmp/'+ filename + '.' +type, function (err) {
			if (err) console.log("error ", err);
			s3Client.putFile('./tmp/'+ filename + '.' +type, '/images/medium/'+ filename + '.' +type, headers, function(err, s3Response) {
				if (err) throw err;
				s3Response.pipe(res);
			});
		});
	});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

