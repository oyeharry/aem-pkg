# aem-pkg

## The Problem

Sometimes you just need to push, pull and sync AEM package from local file system to AEM server frequently for development and you end up doing it manually uploading, downloading and extracting packages.

## This Solution

- Provide simple command to upload and download packages from AEM remote server
- Provide git like commands to keep your local revisioned-package directory sync with your remote AEM server.
- It uses the package manager service API to do all the operations.

## Install

```
$ npm install aem-pkg -g
```

## Usage

```
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
```

## TODO

- `aem-pkg sync` command. This will keep pulling and pushing updates from and to aem server.

## License

MIT ©
