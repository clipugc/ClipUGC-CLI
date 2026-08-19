import readline from 'node:readline';

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

export async function promptInput(message: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Prompt without echoing input (for API keys). Falls back to plain prompt when not a TTY. */
export async function promptSecret(message: string): Promise<string> {
  if (!process.stdin.isTTY) return promptInput(message);

  return new Promise((resolve) => {
    process.stdout.write(message);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value.trim());
      } else if (char === '') {
        // Ctrl+C
        stdin.setRawMode?.(false);
        process.stdout.write('\n');
        process.exit(130);
      } else if (char === '' || char === '\b') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}
