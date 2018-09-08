#!/usr/bin/env node

const path = require('path');
const meow = require('meow');
const aemPkg = require('.');
const isUrl = require('is-url');

const cli = meow(
	`
	Usage
	  $ aem-pkg <command>
	Options
		--protocol          Protocol for package manager service
		--host              Host for package manager service
		--port              Port number for package manager service
		--extractMetaDir    Flag to extract meta directory during push and pull.
		--pkgPropFile       Path to package meta properties.xml file
		--jcrRootDir        Name of JCR root directory
		--pkgService        Path of package manager service
		--username          Username for package manager service authentication
		--password          Password for package manager service authentication
		--installPkg        Flag, whether you want uploaded package installation
		--pkgFilePattern    Package zip file search pattern
		--cwd               Current working directory for operation
	<source> can contain globs if quoted
	Examples
		Clone 'my-aem-package' from remote server for development.
		$ aem-pkg clone my-aem-package
		Push current changes to remote server.
		$ aem-pkg push
		Pull current changes from remote server.
		$ aem-pkg pull
	  Upload all packages from current directory
		$ aem-pkg up
		Upload 'my-aem-pacakge.zip' package from current directory
		$ aem-pkg up my-aem-pacakge.zip
		Extract and upload packages from 'pacakges-zip-file.zip' file. This file should have aem packages.
		$ aem-pkg upzip pacakges-zip-file.zip
		Download, extract and upload packages from URL 'https://www.mypackages.com/pacakges-zip-file.zip' file. This file should have aem packages.
	  $ aem-pkg upzip https://www.mypackages.com/pacakges-zip-file.zip
`,
	{
		flags: {
			protocol: {
				default: 'http',
				type: 'string'
			},
			host: {
				default: 'localhost',
				type: 'string'
			},
			port: {
				default: 4502,
				type: 'number'
			},
			extractMetaDir: {
				default: false,
				type: 'boolean'
			},
			pkgPropFile: {
				default: './META-INF/vault/properties.xml',
				type: 'string'
			},
			jcrRootDir: {
				default: 'jcr_root',
				type: 'string'
			},
			pkgService: {
				default: '/crx/packmgr/service.jsp',
				type: 'string'
			},
			username: {
				default: 'admin',
				type: 'string'
			},
			password: {
				default: 'admin',
				type: 'string'
			},
			installPkg: {
				default: true,
				type: 'boolean'
			},
			pkgFilePattern: {
				default: '*.zip',
				type: 'string'
			},
			cwd: {
				default: process.cwd(),
				type: 'string'
			}
		}
	}
);

const log = console.log.bind(console); //eslint-disable-line

if (cli.input.length) {
	const cmd = cli.input[0];
	const opts = cli.flags;
	let pkgSrc;
	let curAemPkg;

	switch (cmd) {
		case 'clone':
			pkgSrc = cli.input[1];
			if (pkgSrc) {
				curAemPkg = aemPkg.clone(pkgSrc, opts);
			} else {
				log('Package name required. $ aem-pkg --help');
			}
			break;
		case 'pull':
			curAemPkg = aemPkg.pull(opts);
			break;
		case 'push':
			curAemPkg = aemPkg.push(opts);
			break;
		case 'up':
			pkgSrc = cli.input[1];
			if (pkgSrc) {
				curAemPkg = aemPkg.uploadPkg(pkgSrc, opts);
			} else {
				curAemPkg = aemPkg.uploadPkgsFromDir(opts.cwd, opts);
			}
			break;
		case 'upzip':
			pkgSrc = cli.input[1];
			if (pkgSrc) {
				if (isUrl(pkgSrc)) {
					curAemPkg = aemPkg.uploadPkgsFromZipUrl(pkgSrc);
				} else {
					curAemPkg = aemPkg.uploadPkgsFromZip(pkgSrc);
				}
			} else {
				log('Packages zip file name or url is required. $ aem-pkg --help');
			}
			break;
		default:
			log('Invalid Command');
			break;
	}

	if (curAemPkg) {
		curAemPkg.catch(e => log(e));
	}
} else {
	log('No command. $ aem-pkg --help');
}
