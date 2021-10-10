const mineflayer = require('mineflayer')
const readline = require('readline')
const mcData = require('minecraft-data')('1.12.2')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

const trustedAccounts = ['Ic3Tank']

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.on('line', async (line) => {
  const cmd = line.split(' ')
  if (cmd[0].startsWith('dupe')) {
    if (!cmd[1] || !cmd[2]) return console.info('Invalid use')
    await dupe(cmd[1], cmd[2])
  } else if (cmd[0] === 'test') {
    console.info(bot.inventory.items())
  }
})

const bot = mineflayer.createBot({
  host: '5b5t.org',
  username: 'Ic3Tank@web.de',
  password: 'qv1j440nGH2nZZXC17Uw',
  version: '1.12.2'
})

async function dupe (itemName, count) {
  let counter = 0
  while (counter < count) {
    counter += 1
    let itemToDupe = bot.inventory.items().find(i => i.name.includes(itemName))
    if (!itemToDupe) return console.info('I dont have that item')

    await validStackItems()

    console.info('item count', itemToDupe.type, bot.inventory.count(itemToDupe.type))
    if (bot.inventory.count(itemToDupe.type) > 1) {
      try {
        console.info(itemToDupe.type)
        await depositExcess(itemToDupe.type)
      } catch (e) {
        console.error('Something went wrong')
        console.error(e)
        return
      }
    } else {
      console.info('Not depositing excess items')
    }
    itemToDupe = bot.inventory.items().find(i => i.name.includes(itemName))
    if (!itemToDupe) throw Error('Item vanished')
    const planks = bot.inventory.items().filter(i => i.name === 'planks')
    if (planks.length === 0 || planks.reduce((p, c) => p.count + c.count) < 8) return console.info('missing planks')
    await bot.lookAt(bot.entity.position.offset(0, -1, 0), true)
    await bot.tossStack(itemToDupe)
    await wait(1000)
    await sendCraftingPackets()
    await wait(1000)

    await resetInventory()

    await depositExcess()
  }
}

async function resetInventory () {
  console.info('Resetting inventory')
  await depositHoldingItem()
  await validStackItems()
  await depositHoldingItem()

  async function clickEmptySlot () {
    const emptySlot = bot.inventory.firstEmptySlotRange(bot.inventory.inventoryStart, bot.inventory.inventoryEnd)
    await bot.clickWindow(emptySlot, 1, 0)
    await wait(200)
  }

  if (bot.inventory.selectedItem) await clickEmptySlot()

  let items = bot.inventory.itemsRange(1, 5)
  while (items.length > 0) {
    const item = items[0]
    console.info('Crafting slots not empty found', item)
    await bot.clickWindow(item.slot, 1, 0)
    await wait(200)
    await clickEmptySlot()
    // await bot.transfer({
    //   window: bot.inventory,
    //   itemType: item.type,
    //   metadata: item.metadata,
    //   sourceStart: 1,
    //   sourceEnd: 5,
    //   destStart: bot.inventory.inventoryStart,
    //   destEnd: bot.inventory.inventoryEnd
    // })
    // await wait(1000)
    items = bot.inventory.itemsRange(1, 5)
  }
}

async function depositHoldingItem () {
  const window = bot.currentWindow || bot.inventory
  if (window.selectedItem) {
    console.info('Depositing', window.selectedItem.displayName + ' * ' + window.selectedItem.count)
    const firstEmptySlot = window.firstEmptyInventorySlot()
    await bot.clickWindow(firstEmptySlot, 1, 0)
    await wait(500)
  }
}

async function validStackItems () {
  for (const i of bot.inventory.items()) {
    if (i.count > i.stackSize) {
      console.info('Unstacking', i)
      await bot.clickWindow(i.slot, 1, 0)
      await wait(500)
      const emptySlot = bot.inventory.firstEmptyInventorySlot()
      await bot.clickWindow(emptySlot, 1, 0)
      await wait(500)
      await depositHoldingItem()
    }
  }
  await depositHoldingItem()
}

async function depositExcess (type) {
  bot.lookAt(bot.entity.position.offset(1, 1.6, 0))
  await wait(200)
  while (bot.inventory.count(type) > 1) {
    const items = bot.inventory.slots.filter(i => i && i.type === type)
    let toKeep = 1
    if (items.length > 1) toKeep = 0
    const item = items[0]
    bot.toss(item.type, item.metadata, item.count - toKeep)
    await wait(1000)
  }
}

async function depositExcessToChest (type) {
  const containerBlock = bot.findBlock({
    matching: mcData.blocksByName.chest.id,
    maxDistance: 3
  })
  if (!containerBlock) throw new Error('no dumping container found')
  bot.lookAt(containerBlock.position, true)
  /** @type {import('prismarine-windows').Window} */
  const container = await bot.openChest(containerBlock)
  let item = container.findItemRange(container.inventoryStart, container.inventoryEnd, type)
  while (item) {
    await container.deposit(type, null, Math.min(item.count, 64))
    await wait(500)
    item = container.findItemRange(container.inventoryStart, container.inventoryEnd, type)
  }
  await container.withdraw(type, null, 1)
  await wait(500)
  container.close()
  await wait(1000)
}

async function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendCraftingPackets () {
  const amount = 5
  const delay = 500
  for (let i = 0; i < amount; i++) {
    bot._client.write('craft_recipe_request', {
      windowId: bot.inventory.id,
      recipe: 29,
      makeAll: false
    })
    await wait(delay)
  }
}

bot.on('spawn', () => {
  const defaultMovements = new Movements(bot, mcData)
  bot.loadPlugin(pathfinder)
  bot.pathfinder.setMovements(defaultMovements)
  console.info('spawned')
})

bot.on('whisper', (username, message) => {
  console.info(username, message, typeof message)
  if (!trustedAccounts.includes(username)) return
  console.info('Valid user')
  if (message.startsWith('come')) {
    const target = bot.players[username]
    if (!target) {
      console.info('Cannot see user', username)
      return
    }
    const goal = new goals.GoalNear(target.entity.position.x, target.entity.position.y, target.entity.position.z, 1)
    bot.pathfinder.setGoal(goal)
  } else if (message === 'stop') {
    bot.pathfinder.setGoal(null)
  }
})

bot.on('error', (err) => {
  console.error('Bot error', err)
})

bot.on('end', () => {
  console.info('Bot disconnected')
})

bot.on('kicked', (reason) => {
  console.error('Bot kicked for reason', reason)
})
