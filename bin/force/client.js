const AliOss = require("ali-oss");
const fs = require("fs");
const chalk = require("chalk");

class ForceClient {
  constructor(argv) {
    const { accessKeyId, accessKeySecret, bucket, region } = argv;

    this.client = new AliOss({
      accessKeyId,
      accessKeySecret,
      bucket,
      region,
    });
  }

  async upload(localDirPath, prefix = "") {
    const filenames = fs.readdirSync(localDirPath);

    for (const filename of filenames) {
      const nestedFilePath = `${localDirPath}/${filename}`;
      if (fs.lstatSync(nestedFilePath).isDirectory()) {
        await this.upload(nestedFilePath, `${prefix}/${filename}`);
      } else {
        let ssoFileKey = `${prefix}/${filename}`;
        if (ssoFileKey.startsWith("/")) {
          ssoFileKey = ssoFileKey.slice(1);
        }
        const response = await this.client.put(ssoFileKey, nestedFilePath);

        if (response?.res?.statusMessage == "OK") {
          console.log(chalk.green(`已上传: ${ssoFileKey}`));
        } else {
          console.log(
            chalk.yellow(
              `[Failed] 上传失败: ${ssoFileKey}, ${response?.res?.statusMessage}`
            )
          );
        }
      }
    }
  }

  async getOSSFiles() {
    const existFiles = await this.client.list();
    return existFiles.objects;
  }

  async removeOSSFiles() {
    const existFiles = await this.getOSSFiles();
    if (existFiles && existFiles.length) {
      const deleteRes = await this.client.deleteMulti(
        existFiles.map((v) => v.name)
      );
      console.log("bucket清空成功！\n删除文件：", deleteRes.deleted);
    } else {
      console.log("bucket为空");
    }
  }
}

module.exports = ForceClient;
