var fs = require('fs');
var path = require('path');

var tree = function(dir, done, up) {
	if(up){
		dir = path.resolve(dir,'..');
	}
	var results = {
		"text": path.basename(dir),
		"path": dir,
		"dir": [],
		"files": []
	};
	fs.readdir(dir, function(err, list) {
		if (err) {
			return done({});
		}
		var pending = list.length;
		if (!pending) {
			return done(null, results);
		}
		list.forEach(function(file) {
			var filepath = path.join(dir, file);
			fs.stat(filepath, function(err, stat) {
				if (stat && stat.isDirectory()) {
					results.dir.push({
						"text": file,
						"tree": true,
						icon: "glyphicon glyphicon-stop",
						selectedIcon: "glyphicon glyphicon-stop",
						path: filepath
					});
					if (!--pending) {
						done(null, results);
					}
				} else {
					results.files.push({
						"text": file,
						"tree": false,
						path: filepath
					});
					if (!--pending) {
						done(null, results);
					}
				};
			});
		});
	})
}


var subtree = function(dir, done) {
	var results = {
		"text": path.basename(dir),
		"path": dir,
		"dir": [],
		"files": []
	};
	fs.readdir(dir, function(err, list) {
		if (err) {
			return done({});
		}
		var pending = list.length;
		if (!pending) {
			return done(null, results);
		}
		list.forEach(function(file) {
			var filepath = path.join(dir, file);
			fs.stat(filepath, function(err, stat) {
				if (stat && stat.isDirectory()) {
					results.dir.push({
						"text": file,
						"tree": true,
						icon: "glyphicon glyphicon-stop",
						selectedIcon: "glyphicon glyphicon-stop",
						path: filepath
					});
					if (!--pending) {
						done(null, results);
					}
				} else {
					results.files.push({
						"text": file,
						"tree": false,
						path: filepath
					});
					if (!--pending) {
						done(null, results);
					}
				};
			});
		});
	})
}

module.exports.tree = tree;
module.exports.subtree = subtree;