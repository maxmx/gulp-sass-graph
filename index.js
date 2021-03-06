'use strict';
var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var _ = require('lodash');
var path = require('path');
var glob = require('glob');
var File = require('vinyl');

module.exports = function (loadPaths) {
	var graph = {};

	// adds a sass file to a graph of dependencies
	var addToGraph = function (filepath, contents, parent) {
		filepath = path.normalize(filepath);
		var entry = graph[filepath] = graph[filepath] || {
			path: filepath,
			imports: [],
			importedBy: [],
			modified: fs.statSync(filepath).mtime
		};
		var imports = sassImports(contents());
		var cwd = path.dirname(filepath);

		imports = _.filter(imports, function(imp) { return imp.indexOf('.css') === -1;});

		for (var i in imports) {
			var resolved = sassResolve(imports[i], loadPaths.concat([cwd]));
			if (!resolved) return false;

			// recurse into dependencies if not already enumerated
			if (!_.contains(entry.imports, resolved)) {
				entry.imports.push(resolved);
				addToGraph(resolved, function () {
					return fs.readFileSync((path.extname(resolved) !== "" ?
						resolved : resolved + ".scss"), 'utf8');
				}, filepath);
			}
		}

		// add link back to parent
		if (parent) {
			entry.importedBy.push(parent);
		}

		return true;
	};

	// visits all files that are ancestors of the provided file
	var visitAncestors = function (filepath, callback, visited) {
		filepath = path.normalize(filepath);
		visited = visited || [];
		var edges = graph[filepath].importedBy;

		for (var i in edges) {
			if (!_.contains(visited, edges[i])) {
				visited.push(edges[i]);
				callback(graph[edges[i]]);
				visitAncestors(edges[i], callback, visited);
			}
		}
	};

	// parses the imports from sass
	var sassImports = function (content) {
		var re = /\@import (["'])(.+?)\1\s*;/g, match = {}, results = [];

		content = new String(content)
			// strip comments
			.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '')
			// concat multiline import separated with comma
			.replace(/,\s*(\n|\n\r|\r)/g, ',');

		// extract imports
		while (match = re.exec(content)) {
			var matchedString = match[2];
			//multiline import support
			if (matchedString.search(',') > 0) {
				var multiImports = matchedString
					//remove quotation marks for splitting
					.replace(/'|"|\s/g, '')
					.split(',');
				for (var i in multiImports) {
					results.push(multiImports[i]);
				}
			} else {
				results.push(match[2]);
			}
		}

		return results;
	};

	// resolve a relative path to an absolute path
	var sassResolve = function (path, loadPaths) {
		for (var p in loadPaths) {
			var scssPath = loadPaths[p] + "/" + path.replace(/\.scss$/, "") + ".scss";
			if (fs.existsSync(scssPath)) {
				return scssPath;
			}
			var partialPath = scssPath.replace(/\/([^\/]*)$/, '/_$1');
			if (fs.existsSync(partialPath)) {
				return partialPath;
			}
		}

		console.warn("failed to resolve %s from ", path, loadPaths);
		return false;
	};

	// builds the graph
	_(loadPaths).forEach(function (path) {
		_(glob.sync(path + "/**/*.scss", {})).forEach(function (file) {
			if (!addToGraph(file, function () {
					return fs.readFileSync(file);
				})) {
				console.warn("failed to add %s to graph", file);
			}
		});
	});

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			this.push(file);
			return cb();
		}

		if (file.isStream()) {
			this.emit('error',
				new gutil.PluginError('gulp-sass-graph', 'Streaming not supported'));
			return cb();
		}

		var filePath= path.normalize(file.path);
		fs.stat(filePath, function (err, stats) {
			if (err) {
				// pass through if it doesn't exist
				if (err.code === 'ENOENT') {
					this.push(file);
					return cb();
				}

				this.emit('error', new gutil.PluginError('gulp-sass-graph', err));
				this.push(file);
				return cb();
			}

			if (!graph[filePath]) {
				addToGraph(filePath, function () {
					return file.contents.toString('utf8');
				});
			}

			this.push(file);

			// push ancestors into the pipeline
			visitAncestors(filePath, function (node) {
				//console.log("processing %s, which depends on %s", node.path, file.path);
				this.push(new File({
					cwd: file.cwd,
					base: file.base,
					path: node.path,
					contents: new Buffer(fs.readFileSync(node.path, 'utf8'))
				}));
			}.bind(this));

			cb();
		}.bind(this));
	});
};