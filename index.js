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
const prettyBytes = require('pretty-bytes');
const logUpdate = require('log-update');
const isUrl = require('is-url');

const xml2jsAsync = pify(xml2js);
const fsAsync = pify(fs);

const log = console.log.bind(console); //eslint-disable-line

/**
 * @typedef {Object}
 * @property {String} [protocol="http"]  Protocol for package manager service. (optional, default `http`)
 * @property {String} [host="localhost"] Host for package manager service. (optional, default `localhost`)
 * @property {Number} [port=4502] Port number for package manager service. (optional, default `4502`)
 * @property {Boolean} [extractMetaDir=false] Flag to extract meta directory during push and pull.. (optional, default `false`)
 * @property {String} [pkgPropFile="./META-INF/vault/properties.xml"] Path to package meta . properties.xml file (optional, default `./META-INF/vault/properties.xml`)
 * @property {String} [jcrRootDir="jcr_root"] Name of JCR root directory. (optional, default `jcr_root`)
 * @property {String} [pkgService="/crx/packmgr/service.jsp"] Path of package manager service. (optional, default `/crx/packmgr/service.jsp`)
 * @property {String} [username="admin"] Username for package manager service authentication. (optional, default `admin`)
 * @property {String} [password="admin"] Password for package manager service authentication. (optional, default `admin`)
 * @property {Boolean} [installPkg=true] Flag, whether you want uploaded package installation. (optional, default `true`)
 * @property {String} [pkgFilePattern="*.zip"] Package zip file search pattern. (optional, default `*.zip`)
 * @property {String} [cwd=process.cwd()] Current working directory for operation. (optional, default `process.cwd()`)
 */
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

/**
 * @namespace
 */
const aemPkg = {
  /**
   * @private
   * @param {String} pkgPropFile Path for AEM package properties.xml file
   * @returns {Promise}
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
   * @private
   * @param {Object} opts Options to override default options
   * @returns {Promise}
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
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.buildRemotePkg('my-awesome-aem-website');
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
   * @private
   * @param {String} packageName Name of the package without extension
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
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
   * @private
   * @param {String} pkgName Name of the package without extension
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   */
  async getRemotePkgBuffer(pkgName, opts) {
    await this.buildRemotePkg(pkgName, opts);
    const fileStream = this.getRemotePkgStream(pkgName, opts);

    return await getStream.buffer(fileStream);
  },

  /**
   * @private
   * @param {String} zipFile Path of the zip file to extract
   * @param {String} extractPath Location path to extract the file
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
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
   * @param {String} src Path of the package directory where need to pull the package.
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.pull('./my-aem-pkg-dir/my-aem-website');
   */
  async pull(src, opts) {
    const { pkgPropFile, cwd } = this.getOptions(opts);
    const packageName = await this.getPkgNameFromMeta(pkgPropFile);
    const pkgSrc = path.resolve(cwd, src);

    const zipBuffer = await this.getRemotePkgBuffer(packageName, opts);
    await this.extractZip(zipBuffer, pkgSrc, opts);
  },

  /**
   *
   * @param {String} src Path of the package directory which you need to push to the server.
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.push('./my-aem-pkg-dir/my-aem-website');
   */
  async push(src, opts) {
    const { pkgPropFile, cwd } = this.getOptions(opts);
    const packageName = await this.getPkgNameFromMeta(pkgPropFile);
    const pkgSrc = path.resolve(cwd, src);
    opts.cwd = pkgSrc;

    log('Packaging...');
    const zip = new AdmZip();
    zip.addLocalFolder(pkgSrc);
    const buffer = await zip.toBuffer();

    log('Uploading...');
    const name = `${packageName}.zip`;
    await this.uploadPkg({ buffer, name }, opts);
  },

  /**
   *
   * @param {String} pkgName Name of the package without extension
   * @param {String} cloneDirPath Path of directory to clone the package
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.clone('my-aem-website', './my-aem-pkg-dir/');
   */
  async clone(pkgName, cloneDirPath, opts) {
    const options = this.getOptions(opts);
    const { cwd } = options;
    options.cwd = path.resolve(cwd, cloneDirPath);
    const pkgExtractPath = path.resolve(options.cwd, pkgName);

    const dirExist = await pathExists(pkgExtractPath);

    if (dirExist) {
      return log('Error: Directory already exist');
    }

    log('Cloning package...');
    options.extractMetaDir = true;
    await makeDir(pkgExtractPath);
    const zipBuffer = await this.getRemotePkgBuffer(pkgName, options);
    await this.extractZip(zipBuffer, pkgExtractPath, options);
  },

  /**
   * @private
   * @param {String} msg Message before progress
   * @param {Object} object Got Progress object
   */
  showProgress(msg, { percent, total, transferred }) {
    let progressMsg = '';
    if (total) {
      progressMsg = `${prettyBytes(transferred)}/${prettyBytes(
        total
      )} | ${Math.round(percent * 100)}%`;
    } else if (transferred) {
      progressMsg = `${prettyBytes(transferred)}`;
    }
    logUpdate(`${msg} | ${progressMsg}`);
  },
  /**
   *
   * @param {(String|Object)} file path or file url or object with buffer and filename properties
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.uploadPkg('./my-aem-pkgs/my-website.zip');
   * await aemPkg.uploadPkg('https://www.mywebsite.com/my-aem-pkgs/my-website.zip');
   * await aemPkg.uploadPkg({buffer:zipFileBuffer, name:'my-website'});
   */
  async uploadPkg(file, opts) {
    const { pkgServiceUrl, auth, installPkg } = this.getOptions(opts);
    const body = new FormData();
    let downloadedTempDir;

    if (typeof file === 'string') {
      let filePath;
      if (isUrl(file)) {
        const { writePkgFile, tmpDir } = await this.downloadZipFile(file);
        downloadedTempDir = tmpDir;
        filePath = writePkgFile;
      } else {
        filePath = path.resolve(opts.cwd, file);
      }
      body.append('file', fs.createReadStream(filePath));
    } else {
      let filename = file.name;
      body.append('file', file.buffer, { filename });
      body.append('name', filename);
    }

    body.append('force', 'true');
    body.append('install', installPkg ? 'true' : 'false');

    let uploadFilename = typeof file === 'string' ? file : file.name;
    uploadFilename = path.basename(uploadFilename);

    await got
      .post(pkgServiceUrl, {
        auth,
        body
      })
      .on('uploadProgress', progress => {
        this.showProgress(`Uploading ${uploadFilename}`, progress);
        if (progress.percent === 1) {
          logUpdate.done();
          logUpdate('Installing...');
          logUpdate.done();
        }
      });

    if (downloadedTempDir) {
      await downloadedTempDir.cleanup();
    }
  },

  /**
   *
   * @param {Array} pkgs array of package file paths
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * await aemPkg.uploadPkgs(['./my-aem-pkgs/my-first-website.zip', './my-aem-pkgs/my-second-website.zip', 'https://www.mywebsite.com/my-aem-pkgs/my-second-website.zip']);
   */
  async uploadPkgs(pkgs, opts) {
    await pkgs.reduce((p, pkg) => {
      return p.then(() => this.uploadPkg(pkg, opts));
    }, Promise.resolve());
  },

  /**
   *
   * @param {String} pkgsDir Directory of all package zip
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * // Upload all packages from this directory
   * await aemPkg.uploadPkgsFromDir('./my-aem-pkgs/');
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
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * // Upload packages from zip file which contains many AEM packages
   * await aemPkg.uploadPkgsFromZip('./aem-pkgs/my-aem-pkgs.zip');
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
   * @private
   * @param {String} zipUrl URL of the zip file
   * @returns {Promise} Resolve to {writePkgFile, tmpDir} object
   */
  async downloadZipFile(zipUrl) {
    const tmpDir = await tmpPromise.dir({ unsafeCleanup: true });
    const pkgFileName = 'aem-pkg-download-file.zip';
    const writePkgFile = path.resolve(path.join(tmpDir.path, pkgFileName));

    await new Promise((resolve, reject) => {
      got
        .stream(zipUrl)
        .on('end', resolve)
        .on('downloadProgress', progress => {
          this.showProgress(`Downloading ${path.basename(zipUrl)}`, progress);
        })
        .on('error', reject)
        .pipe(fs.createWriteStream(writePkgFile));
    });

    return { writePkgFile, tmpDir };
  },

  /**
   *
   * @param {String} zipUrl URL of zip file which contains AEM packages
   * @param {Object} [opts=defaultOptions] Options to override default options
   * @returns {Promise}
   * @example
   * // Upload packages from zip file URL which contain many AEM packages
   * await aemPkg.uploadPkgsFromZip('https://www.example.com/packages/my-aem-pkgs.zip');
   */
  async uploadPkgsFromZipUrl(zipUrl, opts) {
    const options = this.getOptions(opts);

    const { writePkgFile, tmpDir } = await this.downloadZipFile(zipUrl);
    await this.uploadPkgsFromZip(writePkgFile, options);
    await tmpDir.cleanup();
  }
};

module.exports = exports = aemPkg;
