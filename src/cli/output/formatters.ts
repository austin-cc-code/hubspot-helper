/**
 * Output formatters for CLI
 *
 * Provides consistent formatting for terminal output including:
 * - Trees
 * - Tables
 * - Lists
 * - JSON output
 * - Color coding
 */

import chalk from 'chalk';

/**
 * Format a tree structure
 */
export interface TreeNode {
  label: string;
  value?: string | number;
  children?: TreeNode[];
  icon?: string;
}

export function formatTree(nodes: TreeNode[], indent: number = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const connector = isLast ? '└─' : '├─';
    const icon = node.icon || '';

    if (node.value !== undefined) {
      lines.push(`${prefix}${connector} ${icon}${node.label}: ${chalk.cyan(node.value)}`);
    } else {
      lines.push(`${prefix}${connector} ${icon}${node.label}`);
    }

    if (node.children && node.children.length > 0) {
      const childPrefix = isLast ? '  ' : '│ ';
      const childIndent = indent + 1;
      const childLines = formatTree(node.children, childIndent);
      lines.push(childLines.split('\n').map(line => `${prefix}${childPrefix}${line.substring(prefix.length + 2)}`).join('\n'));
    }
  });

  return lines.join('\n');
}

/**
 * Format a summary header
 */
export function formatHeader(text: string, icon?: string): string {
  const fullText = icon ? `${icon} ${text}` : text;
  return chalk.bold(fullText);
}

/**
 * Format a section
 */
export function formatSection(title: string, content: string): string {
  return `\n${chalk.bold(title)}\n${content}\n`;
}

/**
 * Format a key-value pair
 */
export function formatKeyValue(key: string, value: string | number | boolean): string {
  return `${chalk.dim(key + ':')} ${chalk.cyan(value)}`;
}

/**
 * Format a list with bullets
 */
export function formatList(items: string[], bullet: string = '•'): string {
  return items.map(item => `  ${bullet} ${item}`).join('\n');
}

/**
 * Format a table
 */
export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export function formatTable(
  columns: TableColumn[],
  rows: Record<string, any>[]
): string {
  if (rows.length === 0) {
    return chalk.dim('  No data');
  }

  // Calculate column widths
  const widths = columns.map(col => {
    const headerWidth = col.header.length;
    const dataWidth = Math.max(
      ...rows.map(row => String(row[col.key] || '').length)
    );
    return col.width || Math.max(headerWidth, dataWidth);
  });

  // Format header
  const header = columns
    .map((col, i) => {
      const text = col.header.padEnd(widths[i]);
      return chalk.bold(text);
    })
    .join('  ');

  // Format separator
  const separator = columns
    .map((_, i) => '─'.repeat(widths[i]))
    .join('  ');

  // Format rows
  const formattedRows = rows.map(row =>
    columns
      .map((col, i) => {
        const value = String(row[col.key] || '');
        if (col.align === 'right') {
          return value.padStart(widths[i]);
        } else if (col.align === 'center') {
          const totalPad = widths[i] - value.length;
          const leftPad = Math.floor(totalPad / 2);
          const rightPad = totalPad - leftPad;
          return ' '.repeat(leftPad) + value + ' '.repeat(rightPad);
        } else {
          return value.padEnd(widths[i]);
        }
      })
      .join('  ')
  );

  return `${header}\n${separator}\n${formattedRows.join('\n')}`;
}

/**
 * Format progress text
 */
export function formatProgress(current: number, total: number, label?: string): string {
  const percentage = Math.round((current / total) * 100);
  const progressText = `${current}/${total} (${percentage}%)`;
  return label
    ? `${label}: ${chalk.cyan(progressText)}`
    : chalk.cyan(progressText);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format confidence level with color
 */
export function formatConfidence(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return chalk.green('High');
    case 'medium':
      return chalk.yellow('Medium');
    case 'low':
      return chalk.red('Low');
  }
}

/**
 * Format status with icon
 */
export function formatStatus(
  status: 'success' | 'error' | 'warning' | 'info',
  message: string
): string {
  switch (status) {
    case 'success':
      return chalk.green(`✓ ${message}`);
    case 'error':
      return chalk.red(`✗ ${message}`);
    case 'warning':
      return chalk.yellow(`⚠ ${message}`);
    case 'info':
      return chalk.blue(`ℹ ${message}`);
  }
}

/**
 * Format box with border
 */
export function formatBox(content: string, title?: string): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length));
  const width = Math.max(maxWidth, title ? title.length : 0) + 4;

  const top = '┌' + '─'.repeat(width - 2) + '┐';
  const bottom = '└' + '─'.repeat(width - 2) + '┘';

  const formattedLines = lines.map(line => {
    const padding = ' '.repeat(width - line.length - 4);
    return `│ ${line}${padding} │`;
  });

  if (title) {
    const titlePadding = ' '.repeat(width - title.length - 4);
    const titleLine = `│ ${chalk.bold(title)}${titlePadding} │`;
    const separator = '├' + '─'.repeat(width - 2) + '┤';
    return [top, titleLine, separator, ...formattedLines, bottom].join('\n');
  }

  return [top, ...formattedLines, bottom].join('\n');
}

/**
 * Format JSON output (when --json flag is used)
 */
export function formatJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Strip ANSI colors from text (for --no-color or file output)
 */
export function stripColors(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[\d+m/g, '');
}
