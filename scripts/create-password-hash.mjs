import { stdin as input, stdout as output } from "node:process";
import { hashPassword } from "../src/lib/auth/password.js";

if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
  throw new Error("Run this command in an interactive terminal.");
}

function readHiddenPassword() {
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password hashing was cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\b" || character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    output.write("Password to hash (input hidden): ");
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

const password = await readHiddenPassword();

const result = await hashPassword(password);
output.write(`PASSWORD_HASH=${result.passwordHash}\nPASSWORD_SALT=${result.passwordSalt}\n`);
