const mineflayer = require('mineflayer')
const readline = require('readline')
const mcData = require('minecraft-data')('1.12.2')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
// const { OctahedronIterator } = require('prismarine-world').iterators
const inventoryViewer = require('mineflayer-web-inventory')
const autodupeLoader = require('../src/loader')

const trustedAccounts = ['']
const whisperPrefix = '/w'

if (process.argv.length < 5 || process.argv.length > 5) {
  console.log('Usage : node index.js <name> <password> <is mojang>')
  console.info(process.argv)
  process.exit(1)
}

/** @type {import('mineflayer').Bot & { autodupe: import('../src/loader').Autodupe }} */
const bot = mineflayer.createBot({
  host: '5b5t.org',
  username: process.argv[2],
  password: process.argv[3],
  version: '1.12.2',
  auth: process.argv[4] ? 'mojang' : 'microsoft'
})

inventoryViewer(bot)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.on('line', async (line) => {
  messageController(line)
})

async function messageController (line, from = null) {
  console.info('Message controller:', `'${line}'`, from)
  const cmd = line.split(' ')
  let resultStr = null
  if (cmd[0].startsWith('dupe')) {
    if (!cmd[1]) {
      resultStr = console.info('Invalid use, Usage: dupe <item name>')
    } else {
      resultStr = await bot.autodupe.dupe(cmd[1], cmd[2])
    }
  } else if (cmd[0] === 'items') {
    resultStr = listItems(cmd[1])
  } else if (cmd[0] === 'where') {
    resultStr = `I am at ${bot.entity.position.toString()}`
  } else if (cmd[0] === 'goto') {
    if (cmd.length === 4) { // goto x y z
      const x = parseInt(cmd[1], 10)
      const y = parseInt(cmd[2], 10)
      const z = parseInt(cmd[3], 10)
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z))
    } else if (cmd.length === 3) { // goto x z
      const x = parseInt(cmd[1], 10)
      const z = parseInt(cmd[2], 10)
      bot.pathfinder.setGoal(new goals.GoalXZ(x, z))
    } else if (cmd.length === 2) { // goto y
      const y = parseInt(cmd[1], 10)
      bot.pathfinder.setGoal(new goals.GoalY(y))
    } else {
      resultStr = 'Invalid use. Usage: goto <(x y z) | (x z) | (y)>'
    }
  } else if (cmd[0] === 'drop') {
    if (!cmd[1]) return console.info('Usage: drop <item name> [stack count]')
    resultStr = await drop(cmd[1], cmd[2])
  } else if (cmd[0] === 'test') {
    // console.info(bot.inventory.selectedItem)
    // console.info(bot.inventory.slots[1], bot.inventory.slots[2], bot.inventory.slots[3], bot.inventory.slots[4])
  } else if (cmd[0] === 'quit') {
    resultStr = 'Quitting'
    setTimeout(bot.end)
  } else if (cmd[0] === 'stack') {
    resultStr = await bot.autodupe.validStack()
  } else {
    resultStr = 'invalid command'
  }

  if (from) {
    chatBack(from, resultStr)
  } else {
    console.info(resultStr)
  }
}

/**
 * Uses `whisperPrefix` to chat results of commands back to the player or the console.
 * @param {string} username Username
 * @param {string} message Message
 * @returns
 */
function chatBack (username, message) {
  if (!message) return
  console.info('Whisper back', username, message)
  bot.chat(`${whisperPrefix} ${username} ${message}`)
}

/**
 * Returns an array of string with found items and stack count.
 * @param {string?} searchStr Optional search string to match items
 * @returns {Array<string>}
 */
function listItems (searchStr) {
  searchStr = searchStr ?? ''
  const items = bot.inventory.items().filter(i => i ? i.name.includes(searchStr) : true).sort((a, b) => {
    return a.name - b.name
  }).map(i => `${i.name} ${i.count}`)
  return items
}

bot.once('spawn', () => {
  const defaultMovements = new Movements(bot, mcData)
  bot.loadPlugins([pathfinder, autodupeLoader])
  bot.pathfinder.setMovements(defaultMovements)
  console.info(bot.username + ' spawned')
})

bot.on('whisper', (username, message) => {
  message = message.trim()
  if (!trustedAccounts.includes(username)) return
  const target = bot.players[username]
  // Ingame whisper specific commands
  if (message.startsWith('come')) {
    if (!target) {
      console.info('Cannot see user', username)
      chatBack(username, 'I cannot see you!')
      return
    }
    const goal = new goals.GoalNear(target.entity.position.x, target.entity.position.y, target.entity.position.z, 1)
    bot.pathfinder.setGoal(goal)
  } else if (message === 'stop') {
    bot.pathfinder.setGoal(null)
  } else if (message === 'follow') {
    console.info('Following', username)
    bot.pathfinder.setGoal(new goals.GoalFollow(target.entity, 3), true)
  } else {
    messageController(message, username)
  }
})

bot.on('error', (err) => {
  console.error('Bot error', err)
})

bot.on('end', () => {
  console.info('Bot disconnected closing readline')
  rl.close()
  process.exit(1)
})

bot.on('kicked', (reason) => {
  console.error('Bot kicked for reason', reason)
})

