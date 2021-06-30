#!/usr/bin/env node

const program = require("commander");
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");
const { exec, spawn, spawnSync } = require("child_process");
const { version } = require("../package.json");
const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

require("./force/index");

program.version(version);

program.parse(process.argv);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("SIGINT", () => {
  process.exit();
});

process.addListener("unhandledRejection", (err) => {
  err.stack
    ? console.log(chalk.red(err.stack))
    : console.error(chalk.red("unknown error"));
});
