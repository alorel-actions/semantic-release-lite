import {warning} from '@actions/core';
import {exec as nodeExec, type ExecException} from 'child_process';

/** Execute a command with some logging */
export async function exec(cmd: string, errMsg: string, outputStderr = true): Promise<string> {
  type Result = [string, string | false, ExecException | null];
  const [stdout, stderr, err] = await new Promise<Result>(resolve => {
    nodeExec(cmd, {encoding: 'utf8'}, (err, stdout, stderr) => {
      resolve([stdout, outputStderr && stderr.trim(), err]);
    });
  });

  if (stderr) {
    warning(`Stderr from ${errMsg}:\n${stderr}`);
  }

  if (err) {
    const outErr = new Error(`Error ${errMsg}: ${err.message}`);
    outErr.cause = err;
    throw outErr;
  }

  return stdout.trim();
}
