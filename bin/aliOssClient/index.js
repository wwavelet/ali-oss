const AliOss = require('ali-oss');
const fs = require('fs');

class AliOssClient {
  /**
   * 初始化aliyun oss相关配置
   *
   * @param {string} accessKeyId ak-id
   * @param {string} accessKeySecret ak-secret
   * @param {string} bucket 上传的bucket
   * @param {string} region bucket所处地区
   */
  constructor(accessKeyId, accessKeySecret, bucket, region) {
    this.client = new AliOss({
      accessKeyId,
      accessKeySecret,
      bucket,
      region,
    });
    this.modifiedFiles = [];
  }

  /**
   * 上传Json变量
   *
   * @param {string} key 上传到的oss地址
   * @param {object} json 需要上传的json对象
   * @param {object} options 上传的附加参数, 参考https://github.com/ali-sdk/ali-oss#putname-file-options
   * @memberof AliOssClient
   */
  async uploadJson(key, json, options) {
    this.client.put(key, Buffer.from(JSON.stringify(json)), options);
  }

  /**
   * 上传文件内的文件到oss中
   *
   * @param {string} localDirPath 上传的文件夹地址
   * @param {string} prefix oss路径的前缀
   * @param {RegExp[]} exceptions 无需上传的文件的正则表达式
   * @param {{force: boolean, removeOldVersion: boolean, sameNameSkip: boolean}} behaviorOptions 上传默认行为的配置
   * @param {object} uploadOptions 上传的附加参数, 参考https://github.com/ali-sdk/ali-oss#putname-file-options
   * @memberof AliOssClient
   */
  async uploadDir(localDirPath, prefix = '', exceptions = [], behaviorOptions, uploadOptions) {
    const filenames = fs.readdirSync(localDirPath);

    for (const filename of filenames) {
      // 如果路径是个文件夹, 递归调用uploadDir
      if (fs.lstatSync(`${localDirPath}/${filename}`).isDirectory()) {
        await this.uploadDir(
          `${localDirPath}/${filename}`,
          `${prefix}/${filename}`,
          exceptions,
          behaviorOptions,
          uploadOptions
        );
      }
      // 如果是路径是文件, 检查是否符合无需上传文件的正则表达式
      else {
        // 需要上传的文件
        if (!isException(filename, exceptions)) {
          let key = `${prefix}/${filename}`;
          if (key.startsWith('/')) {
            key = key.slice(1);
          }

          await this.upload(key, `${localDirPath}/${filename}`, behaviorOptions, uploadOptions);
        }
        // 无需上传的文件
        else {
          console.log(`Exception ${localDirPath}/${filename}`);
        }
      }
    }

    return this.modifiedFiles;
  }

  /**
   * 上传文件
   * @param {string} key 上传到的oss地址
   * @param {string} localPath 上传文件的本地地址
   * @param {{force: boolean, removeOldVersion: boolean, sameNameSkip: boolean}} behaviorOptions 上传默认行为的配置
   * @param {object} uploadOptions 上传的附加参数, 参考https://github.com/ali-sdk/ali-oss#putname-file-options
   * @memberof AliOssClient
   */
  async upload(key, localPath, behaviorOptions, uploadOptions) {
    // 解析文件名, 分为prefix, md5, ext
    const filenameInfo = parseFilename(key);
    const options = uploadOptions ? JSON.parse(JSON.stringify(uploadOptions)) : null;

    // 如果文件名中没有md5值, 则不会使用cache-control
    if (
      (!filenameInfo.md5 || filenameInfo.md5.length === 0 || filenameInfo.md5 === 'min') &&
      options &&
      options.headers &&
      options.headers['Cache-Control']
    ) {
      delete options.headers['Cache-Control'];
    }

    // html文件直接上传并禁止缓存
    if (filenameInfo.ext === 'html') {
      await this.client.put(key, localPath, { headers: { 'Cache-Control': 'no-cache' } });
      this.modifiedFiles.push(key);
      console.log(`Upload ${key}`);
      return;
    }

    // 强制上传
    if (behaviorOptions.force) {
      await this.client.put(key, localPath, options);
      this.modifiedFiles.push(key);
      console.log(`Upload ${key}`);
      return;
    }

    // 获取oss上对应文件前缀的文件列表
    const listResult = await this.client.list({ prefix: filenameInfo.prefix });
    if (listResult.objects && listResult.objects.length > 0) {
      // 同名文件不重复上传
      if (behaviorOptions.sameNameSkip) {
        for (const file of listResult.objects) {
          if (file.name === key) {
            console.log(`Oss exists ${file.name}, needn't upload`);
            return;
          }
        }
      }
      // 是否移除旧版本的文件
      if (behaviorOptions.removeOldVersion) {
        // 找出同名和同扩展名的文件, 记录到oldFiles的数组中
        const oldFiles = [];
        for (const file of listResult.objects) {
          const oldFilenameInfo = parseFilename(file.name);
          if (oldFilenameInfo.prefix === filenameInfo.prefix && oldFilenameInfo.ext === filenameInfo.ext) {
            oldFiles.push(file);
          }
        }

        // 如果同名&同扩展名的文件大于等于2个, 则对oldFiles按照最后修改时间进行排序, 从近到远
        // 然后仅保留最新的一份文件, 其余文件都移除
        if (oldFiles.length >= 2) {
          oldFiles.sort((a, b) => {
            return a.lastModified < b.lastModified ? 1 : -1;
          });
          oldFiles.shift();
          await this.deleteMultiFiles(oldFiles);
        }
      }
    }

    await this.client.put(key, localPath, options);
    this.modifiedFiles.push(key);
    console.log(`Upload ${key}`);
    return;
  }

  /**
   * 删除多个文件
   * @param {string[]} keys 待删除文件的路径数组
   * @memberof AliOssClient
   */
  async deleteMultiFiles(keys) {
    for (let key of keys) {
      if (typeof key !== 'string') {
        key = key.name;
      }
      await this.delete(key);
    }
  }

  /**
   * 删除单个文件
   * @param {string}} key 待删除文件的路径
   * @memberof AliOssClient
   */
  async delete(key) {
    console.log(`Delete ${key}`);
    await this.client.delete(key);
  }
}

/**
 * 判断文件是否符合在无需上传的规则
 * @param {string}} filename
 * @param {RegExp[]} exceptions
 */
function isException(filename, exceptions) {
  if (exceptions && exceptions.length > 0) {
    return exceptions.reduce((pre, cur) => {
      return pre || cur.test(filename);
    }, false);
  }

  return false;
}

/**
 * 解析文件名
 * @param {string} filename 文件名
 * @param {string} md5Separator md5分隔符, 默认'.'
 * @returns { {prefix: string, md5: string, ext: string, filename: string} } prefix: 实际文件名, md5: 打包后计算出来的md5值, ext: 文件扩展名, filename: 输入的文件名参数
 */
function parseFilename(filename, md5Separator = '.') {
  const extSeparator = '.';
  let prefix, md5, ext, filenameWithoutExt;

  if (filename.lastIndexOf(md5Separator) >= 0) {
    // 先分隔出文件扩展名
    ext = filename.slice(filename.lastIndexOf(extSeparator) + 1);
    filenameWithoutExt = filename.slice(0, filename.lastIndexOf(extSeparator));

    // 判断是否还能分隔md5值
    if (filenameWithoutExt.lastIndexOf(md5Separator) >= 0) {
      // 处理类似vendor.md5.bundle.js端情况
      if (filenameWithoutExt.indexOf('.bundle') >= 0) {
        filenameWithoutExt = filenameWithoutExt.slice(0, filenameWithoutExt.lastIndexOf('.bundle'));
      }

      md5 = filenameWithoutExt.slice(filenameWithoutExt.lastIndexOf(md5Separator) + 1);
      prefix = filenameWithoutExt.slice(0, filenameWithoutExt.lastIndexOf(md5Separator));
    } else {
      md5 = '';
      prefix = filenameWithoutExt;
    }
  } else {
    prefix = filename;
    md5 = '';
    ext = filename.slice(filename.lastIndexOf(extSeparator) + 1);
  }

  return {
    prefix,
    md5,
    ext,
    filename,
  };
}

module.exports = AliOssClient;
