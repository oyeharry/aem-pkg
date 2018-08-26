const got = require('got');
const getStream = require('get-stream');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const pify = require('pify');
const makeDir = require('make-dir');
const pathExists = require('path-exists');
const FormData = require('form-data');
const globby = require('globby');

const xml2jsAsync = pify(xml2js);
const fsAsync = pify(fs);

const log = console.log.bind(console); //eslint-disable-line
const defaultOptions = {
	protocol: 'http',
	host: 'localhost',
	port: 4502,
	packagesPath: '/etc/packages',
	extractMetaDir: false,
	pkgPropFile: './META-INF/vault/properties.xml',
	jcrRootDir: 'jcr_root',
	pkgMgrService: '/crx/packmgr/service',
	username: 'admin',
	password: 'admin',
	installPkg: true
};

const aemPkgSync = {
	async getPkgNameFromMeta(pkgPropFile) {
		let pkgPropsXml;
		try {
			pkgPropsXml = await fsAsync.readFile(path.resolve(pkgPropFile), 'utf-8');
		} catch (err) {
			let errMsg;
			if (err.code === 'ENOENT') {
				errMsg = `Invalid package directory. Could not find the package properties on path ${
					err.path
				}`;
			} else {
				errMsg = err;
			}
			throw new Error(errMsg);
		}
		const pkgProps = await xml2jsAsync.parseString(pkgPropsXml);

		const filteredNameNode = pkgProps.properties.entry.filter(
			entry => entry.$.key === 'name'
		);

		return filteredNameNode[0]._;
	},
	getOptions(opt) {
		const options = Object.assign({}, defaultOptions, opt);
		const { host, port, protocol, username, password } = options;

		options.serverPath = `${protocol}://${host}:${port}`;
		options.auth = `${username}:${password}`;
		return options;
	},
	async pull(opt) {
		const {
			packagesPath,
			extractMetaDir,
			jcrRootDir,
			pkgMgrService,
			serverPath,
			auth,
			pkgPropFile
		} = this.getOptions(opt);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		const packagePath = `${packagesPath}/${packageName}/${packageName}.zip`;
		const serverPackageFileUrl = `${serverPath}${packagePath}`;
		const pkgRebuildUrl = `${serverPath}${pkgMgrService}/.json${packagePath}?cmd=build`;

		log('Building package...');
		await got.post(pkgRebuildUrl, {
			auth
		});

		log('Downloading package...');
		const fileStream = got.stream(serverPackageFileUrl, {
			auth
		});

		log('Extracting package...');
		const zipBuffer = await getStream.buffer(fileStream);
		const zip = new AdmZip(zipBuffer);
		const zipEntries = zip.getEntries();
		const extractFiles = zipEntries.filter(
			({ entryName }) =>
				!extractMetaDir && entryName.split(/\//)[0] === jcrRootDir
		);

		const createPaths = extractFiles
			.filter(({ entryName }) => /\/$/.test(entryName))
			.map(({ entryName }) => {
				return pathExists(entryName).then(
					exists => exists || makeDir(entryName)
				);
			});

		await Promise.all(createPaths);

		const createFiles = extractFiles
			.filter(({ entryName }) => !/\/$/.test(entryName))
			.map(({ entryName }) => {
				return fsAsync.writeFile(
					path.resolve(entryName),
					zip.readFile(entryName)
				);
			});

		await Promise.all(createFiles);
		log('Done!');
	},

	async push(opt) {
		const { pkgPropFile } = this.getOptions(opt);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		log('Zipping files...', path.resolve('.'));
		const zip = new AdmZip();
		zip.addLocalFolder(path.resolve('.'));
		const zipBuffer = await zip.toBuffer();

		log('Uploading package...');
		const filename = `${packageName}.zip`;
		await this.uploadPkg(filename, zipBuffer, opt);
		log('Done!');
	},

	async uploadPkg(filename, pkg, opt) {
		const { pkgMgrService, serverPath, auth, installPkg } = this.getOptions(
			opt
		);

		const body = new FormData();
		if (typeof pkg === 'string') {
			body.append('file', fs.createReadStream(path.resolve(pkg)));
		} else {
			body.append('file', pkg, { filename });
		}
		body.append('name', filename);
		body.append('force', 'true');
		body.append('install', installPkg ? 'true' : 'false');

		const pkgUploadUrl = `${serverPath}${pkgMgrService}.jsp`;
		await got.post(pkgUploadUrl, {
			auth,
			body
		});
	}
};

module.exports = exports = aemPkgSync;
