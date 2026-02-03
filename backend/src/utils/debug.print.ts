import { serializeBigInt } from '@/plugins/bigint.handler.js';
import chalk from 'chalk';

export function debugPrint(obj: Record<string, any>, title = 'Debug Info') {
    console.log();
    console.log(chalk.cyan.bold(`--- ${chalk.white.bold(title)} ---`));

    for (const [key, value] of Object.entries(obj)) {
        let displayValue: string;

        if (value === undefined || value === null) {
            displayValue = chalk.gray('(none)');
        } else if (value instanceof Date) {
            displayValue = chalk.magenta(value.toISOString());
        } else if (Array.isArray(value)) {
            displayValue = chalk.yellow(value.length ? value.join(', ') : '(empty array)');
        } else if (typeof value === 'object') {
            displayValue = chalk.magentaBright(JSON.stringify(serializeBigInt(value), null, 2));
        } else {
            displayValue = chalk.cyanBright(value.toString());
        }

        console.log(chalk.green(`${key.padEnd(12)}:`), displayValue);
    }

    console.log(chalk.cyan.bold('---------------------------------------------'));
    console.log();
}

export function debugPrintNested(array: any[], title = 'Debug Info') {
    array.forEach((value, index) => {
        debugPrint(value, `${title} [${index}]`);
    });
}
