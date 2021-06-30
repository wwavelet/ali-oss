const fs = require("fs");
const package = require("../package.json");

function readAccessKey(accessKeyFilePath) {
  try {
    const txt = fs.readFileSync(accessKeyFilePath, "utf8");

    const keys = txt.split("\n")[1].split(",");
    return {
      accessKeyId: keys[0],
      accessKeySecret: keys[1],
    };
  } catch {
    return {}
  }
}

module.exports = {
  readAccessKey,
  tryCatch: (fn) => (...args) => {
    try {
      const promise = fn(...args);
      if (promise && promise.catch)
        promise.catch((e) => {
          console.error(e);
        });
    } catch (e) {
      console.error(e);
    }
  },
};
