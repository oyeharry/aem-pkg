const aemPkg = require('.');
const got = require('got');
const getStream = require('get-stream');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

jest.mock('fs');
jest.mock('got');
jest.mock('get-stream');
jest.mock('adm-zip');

function getOptionsFixture(buildUrlParams = '') {
  const opts = {
    host: 'https://www.example.com',
    port: 4532
  };
  const pkgServiceUrl =
    'http://https://www.example.com:4532/crx/packmgr/service.jsp';
  const pkgName = 'example-aem-pkg';
  const pkgBuildUrl = `${pkgServiceUrl}?name=${pkgName}${buildUrlParams}`;
  return { opts, pkgName, pkgBuildUrl };
}

it('should return valid name on aemPkg.getPkgNameFromMeta', async () => {
  const expectedComponentName = 'awesome-aem-component';
  fs.readFile.mockImplementation((...rest) => {
    rest[rest.length - 1](
      null,
      `
    <?xml version="1.0" encoding="utf-8" standalone="no"?>
    <!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
    <properties>
    <comment>FileVault Package Properties</comment>
    <entry key="name">${expectedComponentName}</entry>
    </properties>
    `
    );
  });

  const componentName = await aemPkg.getPkgNameFromMeta('properties.xml');
  expect(componentName).toBe(expectedComponentName);
});

it('should throw error on aemPkg.getPkgNameFromMeta', async () => {
  fs.readFile.mockImplementation((...rest) => {
    rest[rest.length - 1]({
      code: 'ENOENT'
    });
  });

  try {
    await aemPkg.getPkgNameFromMeta('properties.xml');
  } catch ({ message }) {
    expect(message).toMatch('Error');
  }
});

it('should return valid options on aemPkg.getOptions', () => {
  const opts = {
    host: 'https://www.example.com',
    port: 4532
  };

  const defaultOptions = {
    auth: 'admin:admin',
    protocol: 'http',
    host: 'https://www.example.com',
    port: 4532,
    extractMetaDir: false,
    pkgPropFile: './META-INF/vault/properties.xml',
    jcrRootDir: 'jcr_root',
    pkgService: '/crx/packmgr/service.jsp',
    pkgServiceUrl:
      'http://https://www.example.com:4532/crx/packmgr/service.jsp',
    username: 'admin',
    password: 'admin',
    installPkg: true,
    pkgFilePattern: '*.zip',
    cwd: process.cwd()
  };

  expect(aemPkg.getOptions(opts)).toEqual(defaultOptions);
});

it('should make valid request on aemPkg.buildRemotePkg', async () => {
  const { pkgName, opts, pkgBuildUrl } = getOptionsFixture(`&cmd=build`);
  got.post.mockResolvedValue({});

  await aemPkg.buildRemotePkg(pkgName, opts);
  expect(got.post).toHaveBeenCalledWith(pkgBuildUrl, { auth: 'admin:admin' });
});

it('should return stream on aemPkg.getRemotePkgStream', async () => {
  const { pkgName, opts, pkgBuildUrl } = getOptionsFixture();
  const remoteStream = { stream: '' };
  got.stream.mockReturnValue(remoteStream);

  const stream = aemPkg.getRemotePkgStream(pkgName, opts);
  expect(got.stream).toHaveBeenCalledWith(pkgBuildUrl, { auth: 'admin:admin' });
  expect(stream).toBe(remoteStream);
});

it('should return stream on aemPkg.getRemotePkgBuffer', async () => {
  const { pkgName, opts } = getOptionsFixture();
  const fileStream = { stream: '' };
  const buffer = { buffer: '' };

  aemPkg.buildRemotePkg = jest.fn().mockResolvedValue({});
  aemPkg.getRemotePkgStream = jest.fn().mockReturnValue(fileStream);
  getStream.buffer.mockResolvedValue(buffer);

  await aemPkg.getRemotePkgBuffer(pkgName, opts);
  expect(getStream.buffer).toHaveBeenCalledWith(fileStream);
  expect(buffer).toBe(buffer);
});

it('should fetch aem package and extract on aemPkg.pull', async () => {
  const { pkgName, opts } = getOptionsFixture();
  const fileStream = { stream: '' };
  const pkgBuffer = { buffer: '' };
  const src = './awesome-dir';
  const pkgSrc = path.resolve('./', src);

  aemPkg.getPkgNameFromMeta = jest.fn().mockResolvedValue(pkgName);
  aemPkg.getRemotePkgBuffer = jest.fn().mockResolvedValue(pkgBuffer);
  aemPkg.extractZip = jest.fn();

  await aemPkg.pull(src, opts);
  expect(aemPkg.getRemotePkgBuffer).toHaveBeenCalledWith(pkgName, opts);
  expect(aemPkg.extractZip).toHaveBeenCalledWith(pkgBuffer, pkgSrc, opts);
});

it('should upload aem packages files on aemPkg.push', async () => {
  const { pkgName, opts } = getOptionsFixture();
  const pkgNameZip = `${pkgName}.zip`;
  const fileStream = { stream: '' };
  const buffer = { buffer: '' };
  const src = './awesome-dir';
  const pkgSrc = path.resolve('./', src);
  const addLocalFolderMock = jest.fn();
  const toBufferMock = jest.fn().mockResolvedValue(buffer);

  AdmZip.mockImplementation(function() {
    this.addLocalFolder = addLocalFolderMock;
    this.toBuffer = toBufferMock;
  });

  aemPkg.getPkgNameFromMeta = jest.fn().mockResolvedValue(pkgName);
  aemPkg.uploadPkg = jest.fn();

  await aemPkg.push(src, opts);
  expect(addLocalFolderMock).toHaveBeenCalledWith(pkgSrc);
  expect(aemPkg.uploadPkg).toHaveBeenCalledWith(
    { buffer, name: pkgNameZip },
    opts
  );
});
