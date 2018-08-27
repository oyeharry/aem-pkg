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
	installPkg: true,
	pkgFilePattern: '*.zip',
	cwd: process.cwd()
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

	getOptions(opts) {
		const options = Object.assign({}, defaultOptions, opts);
		const { host, port, protocol, username, password } = options;

		options.serverPath = `${protocol}://${host}:${port}`;
		options.auth = `${username}:${password}`;
		return options;
	},

	async buildServerPkg(packageName, opts) {
		const { packagesPath, pkgMgrService, serverPath, auth } = this.getOptions(
			opts
		);

		const packagePath = `${packagesPath}/${packageName}/${packageName}.zip`;
		const pkgBuildUrl = `${serverPath}${pkgMgrService}/.json${packagePath}?cmd=build`;

		const buildPkg = await got.post(pkgBuildUrl, {
			auth
		});

		return buildPkg;
	},

	getDownloadPkgStream(packageName, opts) {
		const { packagesPath, serverPath, auth } = this.getOptions(opts);

		const packagePath = `${packagesPath}/${packageName}/${packageName}.zip`;
		const serverPackageFileUrl = `${serverPath}${packagePath}`;

		const fileStream = got.stream(serverPackageFileUrl, {
			auth
		});

		return fileStream;
	},

	async extractZip(zipFile, extractPath, opts) {
		const { extractMetaDir, jcrRootDir } = this.getOptions(opts);
		const zipExtractPath = extractPath || './';

		const zip = new AdmZip(zipFile);
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
					path.resolve(path.join(zipExtractPath, entryName)),
					zip.readFile(entryName)
				);
			});

		await Promise.all(createFiles);
	},

	async pull(opts) {
		const { pkgPropFile, cwd } = this.getOptions(opts);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		log('Building package...');
		await this.buildServerPkg(packageName, opts);

		log('Downloading package...');
		const fileStream = this.getDownloadPkgStream(packageName, opts);

		log('Extracting package...');
		const zipBuffer = await getStream.buffer(fileStream);
		await this.extractZip(zipBuffer, cwd, opts);

		log('Done!');
	},

	async push(opts) {
		const { pkgPropFile, cwd } = this.getOptions(opts);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		log('Zipping files...', process.cwd());
		const zip = new AdmZip();
		zip.addLocalFolder(cwd);
		const zipBuffer = await zip.toBuffer();

		log('Uploading package...');
		const filename = `${packageName}.zip`;
		await this.uploadPkg(filename, zipBuffer, opts);
		log('Done!');
	},

	async uploadPkg(filename, pkg, opts) {
		const { pkgMgrService, serverPath, auth, installPkg } = this.getOptions(
			opts
		);

		const body = new FormData();
		if (typeof pkg === 'string') {
			const pkgPath = path.join(pkg, filename);
			body.append('file', fs.createReadStream(path.resolve(pkgPath)));
		} else {
			body.append('file', pkg, { filename });
		}
		body.append('name', filename);
		body.append('force', 'true');
		body.append('install', installPkg ? 'true' : 'false');

		log(`Uploading: ${filename}`);
		const pkgUploadUrl = `${serverPath}${pkgMgrService}.jsp`;
		await got.post(pkgUploadUrl, {
			auth,
			body
		});
		log('Done!');
	},

	async uploadPkgs(pkgsDirectory, opts) {
		const options = this.getOptions(opts);
		const cwd = path.resolve(pkgsDirectory || options.cwd);
		const pkgs = await globby(options.pkgFilePattern, {
			cwd
		});

		await pkgs.reduce((pkgsUpload, pkg) => {
			return pkgsUpload.then(() => this.uploadPkg(pkg, cwd, opts));
		}, Promise.resolve());
	}
};

module.exports = exports = aemPkgSync;
