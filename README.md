# aem-pkg

## The Problem

Sometimes you just need to push, pull and sync AEM package from local file system to AEM server frequently for development and you end up doing it manually uploading, downloading and extracting packages.

## This Solution

-   Provide simple command to upload and download packages from AEM remote server
-   Provide git like commands to keep your local revisioned-package directory sync with your remote AEM server.
-   It uses the package manager service API to do all the operations.

## Install

    $ npm install aem-pkg -g

## Usage

    $ aem-pkg --help

      Usage
        $ aem-pkg <command>
      Options
      	--protocol=<protocol>      Protocol for package manager service
      	--host=<host>              Host for package manager service
      	--port=<port>              Port number for package manager service
      	--extractMetaDir=<extractMetaDir>    Flag, whether you want to extract meta directory during push and pull.
      	--pkgPropFile=<pkgPropFile>       Path to package meta properties.xml file
      	--jcrRootDir =<jcrRootDir>       Name of JCR root directory
      	--pkgService=<pkgService>        Path of package manager service
      	--username=<username>          Username for package manager service authentication
      	--password=<password>          Password for package manager service authentication
      	--installPkg=<installPkg>        Flag, whether you want uploaded package installation
      	--pkgFilePattern=<pkgFilePattern>    Package zip file search pattern
      	--cwd=<dir>               Current working directory for operation

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

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Options

Type: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

#### Properties

-   `protocol` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Protocol for package manager service
-   `host` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Host for package manager service
-   `port` **[Number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** Port number for package manager service
-   `extractMetaDir` **[Boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)?** Flag to extract meta directory during push and pull.
-   `pkgPropFile` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Path to package meta properties.xml file
-   `jcrRootDir` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Name of JCR root directory
-   `pkgService` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Path of package manager service
-   `username` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Username for package manager service authentication
-   `password` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Password for package manager service authentication
-   `installPkg` **[Boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)?** Flag, whether you want uploaded package installation
-   `pkgFilePattern` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Package zip file search pattern
-   `cwd` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** Current working directory for operation

### aemPkg

#### buildRemotePkg

##### Parameters

-   `pkgName` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Name of the package to build without extension
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### pull

##### Parameters

-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### push

##### Parameters

-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### clone

##### Parameters

-   `pkgName` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Name of the package without extension
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### uploadPkg

##### Parameters

-   `file` **([String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object))** path or object with buffer and filename properties
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### uploadPkgs

##### Parameters

-   `pkgs` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)** array of package file paths
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### uploadPkgsFromDir

##### Parameters

-   `pkgsDir` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Directory of all package zip
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### uploadPkgsFromZip

##### Parameters

-   `zipFile` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Path of zip file which contains many packages. All will be uploaded individually.
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

#### uploadPkgsFromZipUrl

##### Parameters

-   `zipUrl` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** URL of zip file which contain AEM packages
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options to override default options (optional, default `defaultOptions`)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## TODO

-   `aem-pkg sync` command. This will keep pulling and pushing updates from and to aem server.

## License

MIT ©
