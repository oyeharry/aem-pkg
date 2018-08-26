#!/usr/bin/env node

const meow = require('meow');
const aemPkgSync = require('.');

const cli = meow(
	`
	Usage
	  $ cpy <source>... <destination>
	Options
	  --no-overwrite       Don't overwrite the destination
	  --parents            Preserve path structure
	  --cwd=<dir>          Working directory for files
	  --rename=<filename>  Rename all <source> filenames to <filename>
	<source> can contain globs if quoted
	Examples
	  Copy all .png files in src folder into dist except src/goat.png
	  $ cpy 'src/*.png' '!src/goat.png' dist
	  Copy all .html files inside src folder into dist and preserve path structure
	  $ cpy '**/*.html' '../dist/' --cwd=src --parents
`,
	{
		flags: {
			overwrite: {
				type: 'boolean',
				default: true
			},
			parents: {
				type: 'boolean',
				default: false
			},
			cwd: {
				type: 'string',
				default: process.cwd()
			},
			rename: {
				type: 'string'
			}
		}
	}
);

// aemPkgSync.pull().then(() => {
// 	// console.log('whoa');
// });

aemPkgSync.push().then(() => {
	// console.log('whoa');
});
