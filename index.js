const got = require("got");
const getStream = require("get-stream");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const xml2js = require("xml2js");
const pify = require("pify");
const makeDir = require("make-dir");
const pathExists = require("path-exists");
const FormData = require("form-data");
const globby = require("globby");

const xml2jsAsync = pify(xml2js);
const fsAsync = pify(fs);

const log = console.log.bind(console); //eslint-disable-line
const defaultOptions = {
  protocol: "http",
  host: "localhost",
  port: 4502,
  extractMetaDir: false,
  pkgPropFile: "./META-INF/vault/properties.xml",
  jcrRootDir: "jcr_root",
  pkgService: "/crx/packmgr/service.jsp",
  username: "admin",
  password: "admin",
  installPkg: true,
  pkgFilePattern: "*.zip",
  cwd: process.cwd()
};

const aemPkgSync = {
  async getPkgNameFromMeta(pkgPropFile) {
    let pkgPropsXml;
    try {
      pkgPropsXml = await fsAsync.readFile(path.resolve(pkgPropFile), "utf-8");
    } catch (err) {
      let errMsg;
      if (err.code === "ENOENT") {
        errMsg = `Error: Not a AEM package directory: ${err.path}`;
      } else {
        errMsg = err;
      }
      throw new Error(errMsg);
    }
    const pkgProps = await xml2jsAsync.parseString(pkgPropsXml);

    const filteredNameNode = pkgProps.properties.entry.filter(
      entry => entry.$.key === "name"
    );

    return filteredNameNode[0]._;
  },

  getOptions(opts) {
    const options = Object.assign({}, defaultOptions, opts);
    const { host, port, protocol, pkgService, username, password } = options;

    options.pkgServiceUrl = `${protocol}://${host}:${port}${pkgService}`;
    options.auth = `${username}:${password}`;
    return options;
  },

  async buildRemotePkg(pkgName, opts) {
    const { pkgServiceUrl, auth } = this.getOptions(opts);

    const pkgBuildUrl = `${pkgServiceUrl}?cmd=build&name=${pkgName}`;
    const buildPkg = await got.post(pkgBuildUrl, {
      auth
    });

    return buildPkg;
  },

  getRemotePkgStream(packageName, opts) {
    const { pkgServiceUrl, auth } = this.getOptions(opts);

    const pkgFileUrl = `${pkgServiceUrl}?name=${packageName}`;
    const fileStream = got.stream(pkgFileUrl, {
      auth
    });

    return fileStream;
  },

  async getRemotePkgBuffer(pkgName, opts) {
    await this.buildRemotePkg(pkgName, opts);
    const fileStream = this.getRemotePkgStream(pkgName, opts);

    return await getStream.buffer(fileStream);
  },

  async extractZip(zipFile, extractPath, opts) {
    const { extractMetaDir, jcrRootDir } = this.getOptions(opts);
    const zipExtractPath = extractPath || "./";

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

  async pull(opts) {
    const { pkgPropFile, cwd } = this.getOptions(opts);
    const packageName = await this.getPkgNameFromMeta(pkgPropFile);

    const zipBuffer = await this.getRemotePkgBuffer(packageName);
    await this.extractZip(zipBuffer, cwd, opts);

    log("Done!");
  },

  async push(opts) {
    const { pkgPropFile, cwd } = this.getOptions(opts);
    const packageName = await this.getPkgNameFromMeta(pkgPropFile);

    log("Zipping files...", process.cwd());
    const zip = new AdmZip();
    zip.addLocalFolder(cwd);
    const zipBuffer = await zip.toBuffer();

    log("Uploading package...");
    const filename = `${packageName}.zip`;
    await this.uploadPkg(filename, zipBuffer, opts);
    log("Done!");
  },

  async clone(pkgName, opts) {
    const options = this.getOptions(opts);
    const { cwd } = options;
    const dirExist = await pathExists(pkgName);

    if (dirExist) {
      // return log('Error: Directory already exist');
    }

    log("Cloning package...");
    options.extractMetaDir = true;
    // await makeDir(pkgName);
    const zipBuffer = await this.getRemotePkgBuffer(pkgName, options);
    const extractPath = path.join(cwd, pkgName);
    await this.extractZip(zipBuffer, extractPath, options);
  },

  async uploadPkg(filename, pkg, opts) {
    const { pkgServiceUrl, auth, installPkg } = this.getOptions(opts);

    const body = new FormData();
    if (typeof pkg === "string") {
      const pkgPath = path.join(pkg, filename);
      body.append("file", fs.createReadStream(path.resolve(pkgPath)));
    } else {
      body.append("file", pkg, { filename });
    }
    body.append("name", filename);
    body.append("force", "true");
    body.append("install", installPkg ? "true" : "false");

    log(`Uploading: ${filename}`);
    await got.post(pkgServiceUrl, {
      auth,
      body
    });
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
