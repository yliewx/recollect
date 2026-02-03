import { serializeBigInt } from '@/plugins/bigint.handler.js';
import chalk from 'chalk';

export function debugPrint(obj: Record<string, any>, title = 'Debug Info') {
    console.log();
    console.log(chalk.blue.bold(`--- ${chalk.cyan.bold(title)} ---`));

    for (const [key, value] of Object.entries(obj)) {
        let displayValue: string;

        if (value === undefined || value === null) {
            displayValue = chalk.gray('(none)');
        } else if (Array.isArray(value)) {
            displayValue = chalk.yellow(value.length ? value.join(', ') : '(empty array)');
        } else if (typeof value === 'object') {
            displayValue = chalk.magenta(JSON.stringify(serializeBigInt(value), null, 2));
        } else {
            displayValue = chalk.cyan(value.toString());
        }

        console.log(chalk.green(`${key.padEnd(12)}:`), displayValue);
    }

    console.log(chalk.blue.bold('-------------------------'));
    console.log();
}
