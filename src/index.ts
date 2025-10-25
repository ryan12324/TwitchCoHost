#!/usr/bin/env node

import { loadConfig } from './config';
import { CoHost } from './cohost';
import { WebServer } from './web-server';
import * as readline from 'readline';

async function main() {
  console.log('='.repeat(60));
  console.log('🎮 VTuber CoHost - AI-Powered Stream Assistant');
  console.log('='.repeat(60));

  // Check for GUI mode
  const useGui = process.argv.includes('--gui');

  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error('\n❌ Configuration Error:', error);
    console.error('\nPlease create a .env file based on .env.example\n');
    process.exit(1);
  }

  // Create and start CoHost
  const cohost = new CoHost(config);

  try {
    await cohost.start();
  } catch (error) {
    console.error('❌ Failed to start CoHost:', error);
    process.exit(1);
  }

  // Start web server if GUI mode
  if (useGui) {
    const webServer = new WebServer(cohost, 3000);
    await webServer.start();

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await webServer.stop();
      await cohost.stop();
      process.exit(0);
    });

    // Keep process alive
    console.log('Press Ctrl+C to exit\n');
    return;
  }

  // Set up CLI interface for manual testing
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  console.log('You can type messages here to test the system:');
  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle special commands
    if (input.startsWith('/')) {
      await handleCommand(input, cohost);
      rl.prompt();
      return;
    }

    // Process as regular input
    await cohost.processInput(input, 'chat', 'CLI');
    rl.prompt();
  });

  rl.on('close', async () => {
    await cohost.stop();
    process.exit(0);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT, shutting down gracefully...');
    rl.close();
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM, shutting down gracefully...');
    rl.close();
  });
}

async function handleCommand(command: string, cohost: CoHost) {
  const parts = command.slice(1).split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case 'help':
        console.log('\nAvailable commands:');
        console.log('  /help                 - Show this help message');
        console.log('  /stats                - Show memory statistics');
        console.log('  /search <query>       - Semantic search through memory');
        console.log('  /scenes               - List OBS scenes');
        console.log('  /scene                - Show current OBS scene');
        console.log('  /quit or /exit        - Exit the application');
        console.log('');
        break;

      case 'stats':
        const stats = await cohost.getMemoryStats();
        console.log('\n📊 Memory Statistics:');
        console.log(`  Total messages: ${stats.totalMessages}`);
        console.log('  By source:', stats.bySource);
        console.log('  By role:', stats.byRole);
        console.log('');
        break;

      case 'search':
        if (args.length === 0) {
          console.log('\n❌ Please provide a search query\n');
          console.log('Usage: /search <query>');
          console.log('Example: /search what games did we discuss?\n');
          break;
        }
        const query = args.join(' ');
        console.log(`\n🔍 Searching for: "${query}"\n`);
        const results = await cohost.searchMemory(query, 5);
        if (results.length === 0) {
          console.log('No results found.\n');
        } else {
          console.log(`Found ${results.length} similar messages:\n`);
          results.forEach((msg, i) => {
            const timestamp = msg.timestamp.toLocaleString();
            const source = msg.source ? `[${msg.source}]` : '';
            const user = msg.username ? `${msg.username}: ` : '';
            console.log(`  ${i + 1}. ${source} ${timestamp}`);
            console.log(`     ${user}${msg.content}\n`);
          });
        }
        break;

      case 'scenes':
        const scenes = await cohost.listOBSScenes();
        console.log('\n🎬 OBS Scenes:');
        scenes.forEach((scene, i) => console.log(`  ${i + 1}. ${scene}`));
        console.log('');
        break;

      case 'scene':
        const currentScene = await cohost.getCurrentOBSScene();
        console.log(`\n📹 Current scene: ${currentScene}\n`);
        break;

      case 'quit':
      case 'exit':
        console.log('\nExiting...');
        process.exit(0);
        break;

      default:
        console.log(`\n❌ Unknown command: ${cmd}`);
        console.log('Type /help for available commands\n');
    }
  } catch (error) {
    console.error(`\n❌ Error executing command:`, error);
    console.log('');
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
