const unstackable = require('../data/unstackable.json')
const wait = require('util').promisify(setTimeout)

/**
 * Drops items by there minecraft string name.
 * @callback drop
 * @param {string} itemName Item name or partial item name
 * @param {number?} stackCount Stack count to drop. Default = 1
 * @returns {Promise<string>}
 */

/**
 * Unstacks overstacked items. Ie items that have a stack size over 64.
 * @callback validStack
 * @returns {Promise<void>}
 */

/**
 * Dupes stacks by dropping the item to its feet, sending crafting grid packets and then dropping unstackable items as soon as it picks the stack back up.
 * This allows the bot to bypass the anti stack plugins for shulker boxes, beds and totems. Note tho that duping these unstackable is slow as only one item
 * is duped at the time.
 * Returns the amount of items it has duped in a string text.
 * @callback dupe
 * @param {string} itemName Item name or partial item name to mach inventory items to
 * @param {number?} count Amount of stacks to try and dupe
 * @returns {Promise<string>}
 */

/**
 * @typedef Autodupe
 * @property {dupe} dupe
 * @property {validStack} validStack
 * @property {drop} drop
 */

/**
 * @param {import('mineflayer').Bot} bot
 */
function loader (bot) {
  const load = {}
  load.dupe = dupe
  load.validStack = validStack
  load.drop = drop

  bot.autodupe = load

  /** @type {drop} */
  async function drop (itemName, stackCount = 1) {
    for (let i = 0; i < stackCount; i++) {
      const itemToDrop = bot.inventory.items().find(i => i.name.includes(itemName))
      if (!itemToDrop) return `Error: item ${itemName} not found`
      const nearestPlayer = bot.nearestEntity(e => e.type === 'player')
      if (nearestPlayer) {
        bot.lookAt(nearestPlayer.position.offset(0, 1.6, 0), true)
        await wait(200)
        console.info(`Dropping ${itemToDrop.displayName} at ${nearestPlayer.username}`)
      } else {
        console.info('Dropping ' + itemToDrop.displayName)
      }
      await retry(bot.tossStack, itemToDrop)
      await wait(50)
    }
    return `Dropped ${stackCount} items including string ${itemName}`
  }

  /** @type {validStack} */
  async function validStack () {
    const getInvalid = () => bot.inventory.slots.find(i => i && i.count > 64)
    let invalidItemStack = getInvalid()
    while (invalidItemStack) {
      await retry(bot.clickWindow, invalidItemStack.slot, 0, 0)
      await retry(clickEmptySlot)
      await wait(50)
      invalidItemStack = getInvalid()
    }
    return null
  }

  /** @type {dupe} */
  async function dupe (itemName, count = 1) {
    let counter = 0
    const startCount = bot.inventory.items().filter(i => i.name.includes(itemName)).reduce((p, c) => p + c.count, 0)

    const firstItemOrEmptyHotbarSlot = (item) => {
      for (let i = 0; i < 9; i++) {
        const s = bot.inventory.slots[bot.inventory.hotbarStart + i]
        if ((s && s.name === item.name) || s === null) return i
      }
    }

    while (counter < count) {
      counter += 1

      await cleanupInventory()

      let itemToDupe = bot.inventory.items().find(i => i.name.includes(itemName))
      if (!itemToDupe) return 'I dont have that item'

      itemToDupe = bot.inventory.items().find(i => i.name.includes(itemName))
      if (!itemToDupe) return 'Item vanished'

      const planks = bot.inventory.items().filter(i => i.name === 'planks')
      if (planks.length === 0 || planks.reduce((p, c) => p.count + c.count) < 8) return 'missing planks'

      await bot.lookAt(bot.entity.position.offset(0, -1, 0), true)
      await retry(bot.equip, itemToDupe)
      await retry(bot.tossStack, itemToDupe)
      await wait(1000)
      const craftingPacketsPromise = sendCraftingPackets()
      const slotUpdateFilter = (slot, item) => {
        if (!item) return false
        if (item.name.includes(itemName)) return true
        return false
      }
      try {
        const slotToSelect = firstItemOrEmptyHotbarSlot(itemToDupe)
        bot.setQuickBarSlot(slotToSelect)
        // Wait for item pickup
        const update = await onceWithTimeout(bot.inventory, 'updateSlot', 4000, slotUpdateFilter)
        const item = bot.inventory.slots[update[0]]
        // Only drop with 'Q' if the item was duped and it is part of unshakable items that revert after a short while
        if (item && unstackable.includes(itemToDupe.name)) {
        // If the item that was picked up was not picked up in the selected hotbar slot, switch to that hotbar slot
        // if (bot.quickBarSlot + bot.inventory.hotbarStart !== update[0] && bot.inventory.hotbarStart >= update[0] && bot.inventory.hotbarStart + 9 < update[0]) {
        //   bot.setQuickBarSlot(update[0] - bot.inventory.hotbarStart)
        // }
          bot._client.write('block_dig', {
            status: 4,
            location: { x: 0, y: 0, z: 0 },
            face: 0
          })
        }
      } catch (err) {
        console.info('Encountered error duping')
        console.error(err)
      }
      await craftingPacketsPromise
    }
    await cleanupInventory()
    const itemOnGround = bot.nearestEntity(e => e.name === 'item' && e.position.distanceTo(bot.entity.position) < 1.5)
    if (itemOnGround && bot.inventory.emptySlotCount() !== 0) {
      try {
        await onceWithTimeout(bot, 'slotUpdate', 3000)
      } catch (ignoreError) {}
    }
    const endCount = bot.inventory.items().filter(i => i.name.includes(itemName)).reduce((p, c) => p + c.count, 0)
    console.info()
    await cleanupInventory()
    const successMessage = `Started with ${startCount} ended up with ${endCount}`
    console.info(successMessage)
    return successMessage
  }

  /**
   * Clicks an empty inventory slot or tosses the stack. Can throw errors.
   */
  async function clickEmptySlot () {
    const slot = bot.inventory.firstEmptyInventorySlot() || -999
    await bot.clickWindow(slot, 0, 0)
  }

  /**
   * Remove items from the crafting grid and places items held by the cursor back into the inventory.
   *
   */
  async function cleanupInventory () {
    const hasInvalid = () => {
      return bot.inventory.slots[1] || bot.inventory.slots[2] || bot.inventory.slots[3] || bot.inventory.slots[4]
    }
    while (hasInvalid() || bot.inventory.selectedItem) {
      if (bot.inventory.selectedItem) {
        await retry(clickEmptySlot)
        continue
      }
      for (let i = 1; i <= 4; i++) {
        if (!bot.inventory.slots[i]) continue
        await retry(bot.clickWindow, i, 0, 0)
        await wait(50)
        await retry(clickEmptySlot)
        await wait(50)
        break
      }
    }
  }

  async function retry (func, ...args) {
    const count = 5
    const waitTime = 100
    let lastError
    for (let i = 0; i < count; i++) {
      try {
        const returnValues = await func(...args)
        return returnValues
      } catch (err) {
        lastError = err
        await wait(waitTime)
      }
    }
    console.warn('Retry failed', count, 'times with last error', lastError)
  }

  async function onceWithTimeout (emitter, event, timeout, filter = () => { return true }) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        cleanup()
        reject(new Error('timeout'))
      }, timeout)
      const cleanup = () => {
        clearTimeout(timeoutHandle)
        emitter.removeListener(event, callback)
      }
      const callback = (...args) => {
        if (!filter(...args)) return
        cleanup()
        resolve(args)
      }
      emitter.on(event, callback)
    })
  }

  /**
   * Sends the crafting recipe request packets that messes up the inventory and dupes items.
   * Sends 5 packets with a delay of 500ms. Crafting request is oak wood buttons.
   */
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
}

module.exports = loader
