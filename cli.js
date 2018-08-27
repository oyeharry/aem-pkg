#!/usr/bin/env node

const path = require('path');
const meow = require('meow');
const aemPkgSync = require('.');

const cli = meow(
	`
	Usage
	  $ aem-pkg <command>
	Options
	  --cwd=<dir>          Working directory for files
	<source> can contain globs if quoted
	Examples
	  Upload all packages from current directory
		$ aem-pkg up
		Upload 'sample-aem-pacakge.zip' package from current directory
	  $ aem-pkg up sample-aem-pacakge.zip
`,
	{
		flags: {
			cwd: {
				type: 'string',
				default: process.cwd()
			}
		}
	}
);

const log = console.log.bind(console); //eslint-disable-line

if (cli.input.length) {
	const cmd = cli.input[0];
	let pkgName;
	switch (cmd) {
		case 'pull':
			aemPkgSync.pull();
			break;
		case 'push':
			aemPkgSync.push();
			break;
		case 'up':
			pkgName = cli.input[1];
			if (pkgName) {
				aemPkgSync.uploadPkg(pkgName, path.resolve('./'));
			} else {
				aemPkgSync.uploadPkgs(path.resolve('./'));
			}
			break;
		default:
			log('Invalid Command');
			break;
	}
} else {
	log('No comand');
}
