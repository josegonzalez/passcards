#!/usr/bin/env node

// Utilities for dumping information about the TypeScript
// project associated with the current directory, for use
// in Makefiles and other UNIX tools.
//
// Usage:
//   tsproject.js inputs - Print file names of input
//                         files for the current TS project
//   tsproject.js outputs - Print file names of output
//                          files for the current TS project

var commander = require('commander');
var fs = require('fs');
var path = require('path');

// Walk up the directory tree starting from the current directory
// until a tsconfig.json file is found
function findProjectFile() {
	var dir = process.cwd();
	while (path.dirname(dir) !== dir) {
		var tsconfigPath = path.join(dir, 'tsconfig.json');
		if (fs.existsSync(tsconfigPath)) {
			return tsconfigPath;
		}
		dir = path.dirname(dir);
	}
	return null;
}

function readProjectFile(projectFile) {
	if (!projectFile) {
		throw new Error('Failed to find tsconfig.json project file');
	}
	return JSON.parse(fs.readFileSync(projectFile));
}

commander
  .arguments('<cmd> [tsconfig.json path]')
  .action(function(command, projectFile) {
	projectFile = projectFile || findProjectFile();
	var project = readProjectFile(projectFile);
	var srcFiles = project.files.filter(function (file) {
		return !file.match(/\.d\.ts$/);
	});

    if (command === 'inputs') {
		console.log(srcFiles.join(' '));
	} else if (command === 'outputs') {
		var outDir = project.compilerOptions.outDir || '.';
		var outFiles = srcFiles.map(function(file) {
			return path.join(outDir, file.replace(/.tsx?$/, '.js'));
		});
		console.log(outFiles.join(' '));
	} else {
		throw new Error('Unrecognized command ' + command);
	}
  });

module.exports = {
	findProjectFile: findProjectFile,
	readProjectFile: readProjectFile
};

if (require.main === module) {
	commander.parse(process.argv);
}

