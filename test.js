const aemPkg = require('.');
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

jest.mock('fs');

test('aemPkg.getPkgNameFromMeta', async () => {
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
