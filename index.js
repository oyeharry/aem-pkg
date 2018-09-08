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
const tmpPromise = require('tmp-promise');

const xml2jsAsync = pify(xml2js);
const fsAsync = pify(fs);

const log = console.log.bind(console); //eslint-disable-line
const defaultOptions = {
	protocol: 'http',
	host: 'localhost',
	port: 4502,
	extractMetaDir: false,
	pkgPropFile: './META-INF/vault/properties.xml',
	jcrRootDir: 'jcr_root',
	pkgService: '/crx/packmgr/service.jsp',
	username: 'admin',
	password: 'admin',
	installPkg: true,
	pkgFilePattern: '*.zip',
	cwd: process.cwd()
};

const aemPkgSync = {
	/**
	 *
	 * @param {String} pkgPropFile Path for AEM package properties.xml file
	 */
	async getPkgNameFromMeta(pkgPropFile) {
		let pkgPropsXml;
		try {
			pkgPropsXml = await fsAsync.readFile(path.resolve(pkgPropFile), 'utf-8');
		} catch (err) {
			let errMsg;
			if (err.code === 'ENOENT') {
				errMsg = `Error: Not a AEM package directory: ${err.path}`;
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

	/**
	 *
	 * @param {Object} opts Options to override default options
	 */
	getOptions(opts) {
		const options = Object.assign({}, defaultOptions, opts);
		const { host, port, protocol, pkgService, username, password } = options;

		options.pkgServiceUrl = `${protocol}://${host}:${port}${pkgService}`;
		options.auth = `${username}:${password}`;
		return options;
	},

	/**
	 *
	 * @param {String} pkgName Name of the package to build without extension
	 * @param {Object} opts Options to override default options
	 */
	async buildRemotePkg(pkgName, opts) {
		const { pkgServiceUrl, auth } = this.getOptions(opts);

		const pkgBuildUrl = `${pkgServiceUrl}?cmd=build&name=${pkgName}`;
		const buildPkg = await got.post(pkgBuildUrl, {
			auth
		});

		return buildPkg;
	},

	/**
	 *
	 * @param {String} packageName Name of the package without extension
	 * @param {Object} opts Options to override default options
	 */
	getRemotePkgStream(packageName, opts) {
		const { pkgServiceUrl, auth } = this.getOptions(opts);

		const pkgFileUrl = `${pkgServiceUrl}?name=${packageName}`;
		const fileStream = got.stream(pkgFileUrl, {
			auth
		});

		return fileStream;
	},

	/**
	 *
	 * @param {String} pkgName Name of the package without extension
	 * @param {Object} opts Options to override default options
	 */
	async getRemotePkgBuffer(pkgName, opts) {
		await this.buildRemotePkg(pkgName, opts);
		const fileStream = this.getRemotePkgStream(pkgName, opts);

		return await getStream.buffer(fileStream);
	},

	/**
	 *
	 * @param {String} zipFile Path of the zip file to extract
	 * @param {String} extractPath Location path to extract the file
	 * @param {Object} opts Options to override default options
	 */
	async extractZip(zipFile, extractPath, opts) {
		const { extractMetaDir, jcrRootDir } = this.getOptions(opts);
		const zipExtractPath = extractPath || './';

		const zip = new AdmZip(zipFile);
		const zipEntries = zip.getEntries();
		const extractFiles = zipEntries.filter(
			({ entryName }) =>
				extractMetaDir || entryName.split(/\//)[0] === jcrRootDir
		);

		const createPaths = extractFiles
			.filter(({ entryName }) => /\/$/.test(entryName))
			.map(({ entryName }) => {
				const entryPath = path.join(zipExtractPath, entryName);
				return pathExists(entryPath).then(
					exists => exists || makeDir(entryPath)
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

	/**
	 *
	 * @param {Object} opts Options to override default options
	 */
	async pull(opts) {
		const { pkgPropFile, cwd } = this.getOptions(opts);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		const zipBuffer = await this.getRemotePkgBuffer(packageName, opts);
		await this.extractZip(zipBuffer, cwd, opts);

		log('Done!');
	},

	/**
	 *
	 * @param {Object} opts Options to override default options
	 */
	async push(opts) {
		const { pkgPropFile, cwd } = this.getOptions(opts);
		const packageName = await this.getPkgNameFromMeta(pkgPropFile);

		const zip = new AdmZip();
		zip.addLocalFolder(cwd);
		const zipBuffer = await zip.toBuffer();

		const filename = `${packageName}.zip`;
		await this.uploadPkg(filename, zipBuffer, opts);
	},

	/**
	 *
	 * @param {String} pkgName Name of the package without extension
	 * @param {Object} opts Options to override default options
	 */
	async clone(pkgName, opts) {
		const options = this.getOptions(opts);
		const { cwd } = options;
		const dirExist = await pathExists(pkgName);

		if (dirExist) {
			return log('Error: Directory already exist');
		}

		log('Cloning package...');
		options.extractMetaDir = true;
		await makeDir(pkgName);
		const zipBuffer = await this.getRemotePkgBuffer(pkgName, options);
		const extractPath = path.join(cwd, pkgName);
		await this.extractZip(zipBuffer, extractPath, options);
	},

	/**
	 *
	 * @param {String | Object} file path or object with buffer and filename properties
	 * @param {Object} opts Options to override default options
	 */
	async uploadPkg(file, opts) {
		const { pkgServiceUrl, auth, installPkg } = this.getOptions(opts);
		const body = new FormData();

		if (typeof file === 'string') {
			body.append('file', fs.createReadStream(path.resolve(opts.cwd, file)));
		} else {
			let filename = file.name;
			body.append('file', file.buffer, { filename });
			body.append('name', filename);
		}

		body.append('force', 'true');
		body.append('install', installPkg ? 'true' : 'false');

		await got.post(pkgServiceUrl, {
			auth,
			body
		});
	},

	/**
	 *
	 * @param {Array} pkgs array of package file paths
	 * @param {Object} opts Options to override default options
	 */
	async uploadPkgs(pkgs, opts) {
		const options = this.getOptions(opts);

		await pkgs.reduce((pkgsUpload, pkg) => {
			const file = path.resolve(options.cwd, pkg);
			return pkgsUpload.then(() => this.uploadPkg(file, opts));
		}, Promise.resolve());
	},

	/**
	 *
	 * @param {String} pkgsDir Directory of all package zip
	 * @param {Object} opts Options to override default options
	 */
	async uploadPkgsFromDir(pkgsDir, opts) {
		const options = this.getOptions(opts);
		const cwd = path.resolve(options.cwd, pkgsDir);
		const pkgs = await globby(options.pkgFilePattern, {
			cwd
		});

		if (!pkgs.length) {
			throw new Error(`Nothing found on ${cwd}`);
		}

		await this.uploadPkgs(pkgs, { ...options, cwd });
	},

	/**
	 *
	 * @param {String} zipFile Path of zip file which contains many packages. All will be uploaded individually.
	 * @param {Object} opts Options to override default options
	 */
	async uploadPkgsFromZip(zipFile, opts) {
		const options = this.getOptions(opts);
		const { cwd } = options;

		const zip = new AdmZip(path.resolve(cwd, zipFile));
		const zipEntries = zip.getEntries();

		const uploadPkgs = zipEntries
			.filter(({ entryName }) => {
				// filter directory and path.
				return !/\/$/.test(entryName) && !/\//.test(entryName);
			})
			.map(({ entryName }) => {
				return this.uploadPkg(
					{
						buffer: zip.readFile(entryName),
						name: entryName
					},
					options
				);
			});

		await Promise.all(uploadPkgs);
	},

	/**
	 *
	 * @param {String} zipUrl URL of zip file which contain AEM packages
	 * @param {Object} opts Options to override default options
	 */
	async uploadPkgsFromZipUrl(zipUrl, opts) {
		const options = this.getOptions(opts);
		const tmpDir = await tmpPromise.dir({ unsafeCleanup: true });
		const pkgFileName = 'aem-pkgs.zip';
		const writePkgFile = path.resolve(path.join(tmpDir.path, pkgFileName));

		await new Promise((resolve, reject) => {
			got
				.stream(zipUrl)
				.on('end', () => {
					this.uploadPkgsFromZip(writePkgFile, options)
						.then(resolve)
						.catch(reject);
				})
				.on('error', reject)
				.pipe(fs.createWriteStream(writePkgFile));
		});

		await tmpDir.cleanup();
	}
};

module.exports = exports = aemPkgSync;
