#!/usr/bin/env node

const meow = require('meow');
const aemPkgSync = require('.');

const cli = meow(
	`
	Usage
	  $ cpy <command>
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

const log = console.log.bind(console); //eslint-disable-line

if (cli.input.length) {
	const cmd = cli.input[0];
	switch (cmd) {
		case 'pull':
			aemPkgSync.pull();
			break;
		case 'push':
			aemPkgSync.push();
			break;
		default:
			log('Invalid Command');
			break;
	}
} else {
	log('No comand');
}
