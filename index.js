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
	password: 'admin'
};

const aemPkgSync = {
	async getOptions(opt) {
		const options = Object.assign({}, defaultOptions, opt);
		const {
			host,
			port,
			protocol,
			pkgPropFile,
			packageName,
			username,
			password
		} = options;

		options.serverPath = `${protocol}://${host}:${port}`;
		options.auth = `${username}:${password}`;

		if (!packageName) {
			let pkgPropsXml;
			try {
				pkgPropsXml = await fsAsync.readFile(
					path.resolve(pkgPropFile),
					'utf-8'
				);
			} catch (err) {
				throw new Error(
					`Invalid package directory. Could not find the package properties on path ${
						err.path
					}`
				);
			}
			const pkgProps = await xml2jsAsync.parseString(pkgPropsXml);

			const filteredNameNode = pkgProps.properties.entry.filter(
				entry => entry.$.key === 'name'
			);
			options.packageName = filteredNameNode[0]._;
		}

		return options;
	},
	async pull(opt) {
		const {
			packagesPath,
			extractMetaDir,
			jcrRootDir,
			pkgMgrService,
			serverPath,
			packageName,
			auth
		} = await this.getOptions(opt);

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
		const {
			pkgMgrService,
			serverPath,
			packageName,
			auth
		} = await this.getOptions(opt);

		log('Zipping files...', path.resolve('.'));
		const zip = new AdmZip();
		zip.addLocalFolder(path.resolve('.'));

		const zipBuffer = await zip.toBuffer();

		const body = new FormData();
		const filename = `${packageName}.zip`;
		body.append('file', zipBuffer, { filename });
		body.append('name', filename);
		body.append('force', 'true');
		body.append('install', 'true');

		log('Uploading package...');
		const pkgUploadUrl = `${serverPath}${pkgMgrService}.jsp`;
		log(pkgUploadUrl);
		await got
			.post(pkgUploadUrl, {
				auth,
				body
			})
			.then(res => log(res.body));

		log('done');
	}
};

module.exports = exports = aemPkgSync;
