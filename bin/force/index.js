const program = require("commander");
const client = require("./client");
const chalk = require("chalk");
const { readAccessKey } = require("../utils");
const ForceClient = require("./client");

program
  .command("force")
  .requiredOption("-i, --accessKeyId <accessKeyId>")
  .requiredOption("-s, --accessKeySecret <accessKeySecret>")
  // .option("-i, --accessKeyId <accessKeyId>")
  // .option("-s, --accessKeySecret <accessKeySecret>")
  // .option("-c, --accessKeyConfigFilePath <accessKeyConfigFilePath>")
  .requiredOption("-b --bucket <bucket>")
  .requiredOption("-r --region <region>")
  .option('-d --dir <dir>', 'upload directory', '.')
  .description("清空bucket，上传所有资源")
  .action(async (args) => {
    const {
      accessKeyConfigFilePath,
      accessKeyId,
      accessKeySecret,
      bucket,
      region,
      dir
    } = args;

    if (accessKeyId && accessKeySecret) {
      const uploadInstance = new ForceClient({
        accessKeyId,
        accessKeySecret,
        bucket,
        region,
      });

      await uploadInstance.removeOSSFiles()

      await uploadInstance.upload(dir);
      console.log(chalk.green("上传完成！"));

    } else {
      console.log(chalk.yellow("accessKey file not found"));
    }

    process.exit();
    // 缺少参数是，交互提示用户输入
  });
